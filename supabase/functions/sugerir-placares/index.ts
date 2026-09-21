import { createClient } from "@supabase/supabase-js";
import {
  combinarLambdas,
  formaDoTime,
  lambdasDaForma,
  lambdasDasOdds,
  matrizPlacares,
  probResultado,
  sugerirPlacares,
  type JogoH2H,
  type OddsEntrada,
  type RegraPontos,
} from "../_shared/palpite-modelo.ts";
import { formatarMensagem, type JogoConfronto } from "../_shared/telegram.ts";

// Sugestões de placar para o admin, no Telegram, ~2h antes de cada jogo. Uso pessoal: nada
// disso aparece na UI. Custo de API: 1 chamada FlashScore (h2h agrupado) por jogo — as odds
// já foram gravadas em `matches.odds` pelo sync-matches quando o jogo entrou na janela de 2h.

const JANELA_MS = 2 * 60 * 60 * 1000;
// Sem odds ainda e jogo a mais de 75 min: espera a próxima run (o sync pode capturá-las).
// Mais perto que isso, manda só com a forma para não perder o jogo.
const ESPERA_ODDS_ATE_MS = 75 * 60 * 1000;

const HOST = Deno.env.get("RAPIDAPI_HOST") ?? "flashscore4.p.rapidapi.com";
const RAPIDAPI_KEY = Deno.env.get("RAPIDAPI_KEY")!;
const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const TELEGRAM_CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID");

class RateLimitError extends Error {
  constructor(public readonly path: string) {
    super(`FlashScore ${path} 429 (rate limit)`);
    this.name = "RateLimitError";
  }
}

async function fsFetch(path: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const resp = await fetch(`https://${HOST}${path}`, {
      headers: { "x-rapidapi-host": HOST, "x-rapidapi-key": RAPIDAPI_KEY },
      signal: controller.signal,
    });
    if (resp.status === 429) throw new RateLimitError(path);
    if (!resp.ok) throw new Error(`FlashScore ${path} ${resp.status}`);
    return await resp.json();
  } finally {
    clearTimeout(timer);
  }
}

type H2HAgrupado = {
  home_previous_matches?: JogoH2H[];
  away_previous_matches?: JogoH2H[];
  head_to_head_matches?: JogoH2H[];
};

async function enviarTelegram(texto: string): Promise<void> {
  const resp = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text: texto,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });
  if (!resp.ok) throw new Error(`Telegram ${resp.status}: ${await resp.text()}`);
}

type Jogo = {
  id: string;
  api_fixture_id: string;
  time_casa: string;
  time_fora: string;
  inicio_em: string;
  odds: (OddsEntrada & { bookmaker?: string }) | null;
  competicoes: { nome: string } | null;
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  const segredo = req.headers.get("x-cron-secret");
  if (!segredo || segredo !== Deno.env.get("CRON_SECRET")) {
    return json({ ok: false, erro: "não autorizado" }, 401);
  }
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    return json({ ok: false, erro: "TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID não configurados" }, 500);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // ?forcar=<api_fixture_id>: teste manual — ignora janela e trava, e não grava a sugestão
  // (o envio real, 2h antes, continua acontecendo normalmente).
  const forcar = new URL(req.url).searchParams.get("forcar");
  const agora = Date.now();

  const colunas =
    "id, api_fixture_id, time_casa, time_fora, inicio_em, odds, competicoes(nome)";
  const consulta = forcar
    ? supabase.from("matches").select(colunas).eq("api_fixture_id", forcar)
    : supabase
        .from("matches")
        .select(colunas)
        .eq("status", "agendado")
        .gt("inicio_em", new Date(agora).toISOString())
        .lte("inicio_em", new Date(agora + JANELA_MS).toISOString())
        .order("inicio_em");
  const { data: jogosData, error: jogosErro } = await consulta;
  if (jogosErro) {
    console.error(JSON.stringify({ evento: "sugestao_query_erro", mensagem: jogosErro.message }));
    return json({ ok: false, erro: jogosErro.message }, 502);
  }
  let jogos = (jogosData ?? []) as unknown as Jogo[];
  if (jogos.length === 0) return json({ ok: true, pulado: "sem jogo na janela" });

  if (!forcar) {
    const { data: jaEnviados } = await supabase
      .from("sugestoes_placar")
      .select("match_id")
      .in("match_id", jogos.map((j) => j.id));
    const enviados = new Set((jaEnviados ?? []).map((s) => s.match_id as string));
    jogos = jogos.filter((j) => !enviados.has(j.id));
  }

  // Regra vigente (mesmos defaults de recalcular_pontos para jogos da temporada atual).
  const { data: cfg } = await supabase
    .from("app_config")
    .select("chave, valor")
    .in("chave", ["pts_placar_exato", "pts_saldo", "pts_resultado", "pts_gols_time"]);
  const val = (k: string, d: number) =>
    ((cfg ?? []).find((c) => c.chave === k)?.valor as number | undefined) ?? d;
  const regra: RegraPontos = {
    exato: val("pts_placar_exato", 15),
    saldo: val("pts_saldo", 7),
    resultado: val("pts_resultado", 4),
    gols: val("pts_gols_time", 1),
  };

  const resumo = { enviados: 0, aguardando_odds: 0, erros: 0 };

  for (const j of jogos) {
    const falta = new Date(j.inicio_em).getTime() - agora;
    const lOdds = lambdasDasOdds(j.odds);
    if (!forcar && !lOdds && falta > ESPERA_ODDS_ATE_MS) {
      resumo.aguardando_odds++;
      continue;
    }

    try {
      let h2h: H2HAgrupado = {};
      try {
        h2h = (await fsFetch(
          `/api/flashscore/v2/matches/h2h?match_id=${j.api_fixture_id}&grouped=true`
        )) as H2HAgrupado;
      } catch (e) {
        // 429: a quota é compartilhada com o sync-matches — para tudo e deixa a próxima run.
        if (e instanceof RateLimitError) throw e;
        // Outras falhas: segue só com as odds (se houver).
        console.error(
          JSON.stringify({
            evento: "sugestao_h2h_erro",
            api_fixture_id: j.api_fixture_id,
            mensagem: e instanceof Error ? e.message : String(e),
          })
        );
      }

      const ultCasa = h2h.home_previous_matches ?? [];
      const ultFora = h2h.away_previous_matches ?? [];
      const lForma = lambdasDaForma(ultCasa, ultFora, j.api_fixture_id, j.time_casa, j.time_fora);
      const lambdas = combinarLambdas(lOdds, lForma);
      if (!lambdas) {
        console.warn(JSON.stringify({ evento: "sugestao_sem_dados", api_fixture_id: j.api_fixture_id }));
        resumo.erros++;
        continue;
      }
      const fonte = lOdds && lForma ? "odds+forma" : lOdds ? "odds" : "forma";

      const m = matrizPlacares(lambdas.casa, lambdas.fora);
      const sugestoes = sugerirPlacares(m, regra);

      const confronto: JogoConfronto[] = (h2h.head_to_head_matches ?? [])
        .filter((x) => x.match_id !== j.api_fixture_id && x.status === "FINISHED")
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 5)
        .map((x) => ({
          casa: x.home_team.name,
          fora: x.away_team.name,
          gc: Number(x.scores.home),
          gf: Number(x.scores.away),
          data: new Date(x.timestamp * 1000).toISOString(),
        }));

      const texto = formatarMensagem({
        timeCasa: j.time_casa,
        timeFora: j.time_fora,
        competicao: j.competicoes?.nome ?? "",
        inicioEm: j.inicio_em,
        lambdas,
        resultado: probResultado(m),
        sugestoes,
        formaCasa: formaDoTime(ultCasa, j.api_fixture_id, j.time_casa),
        formaFora: formaDoTime(ultFora, j.api_fixture_id, j.time_fora),
        h2h: confronto,
        fonte,
        bookmaker: j.odds?.bookmaker,
      });

      if (forcar) {
        await enviarTelegram(`<i>[teste]</i>\n${texto}`);
        resumo.enviados++;
        continue;
      }

      // Reserva antes de enviar (trava de idempotência); se o envio falhar, libera a reserva
      // para a próxima run tentar de novo.
      const { error: insErro } = await supabase.from("sugestoes_placar").insert({
        match_id: j.id,
        fonte,
        lambda_casa: Number(lambdas.casa.toFixed(3)),
        lambda_fora: Number(lambdas.fora.toFixed(3)),
        sugestoes,
      });
      if (insErro) {
        // 23505 = já reservado por outra run concorrente.
        if (insErro.code !== "23505") {
          console.error(JSON.stringify({ evento: "sugestao_insert_erro", mensagem: insErro.message }));
          resumo.erros++;
        }
        continue;
      }
      try {
        await enviarTelegram(texto);
        resumo.enviados++;
      } catch (e) {
        await supabase.from("sugestoes_placar").delete().eq("match_id", j.id);
        throw e;
      }
    } catch (e) {
      if (e instanceof RateLimitError) {
        console.warn(JSON.stringify({ evento: "rate_limit", path: e.path }));
        return json({ ok: false, motivo: "429", ...resumo });
      }
      resumo.erros++;
      console.error(
        JSON.stringify({
          evento: "sugestao_erro",
          api_fixture_id: j.api_fixture_id,
          mensagem: e instanceof Error ? e.message : String(e),
        })
      );
    }
  }

  return json({ ok: true, ...resumo });
});

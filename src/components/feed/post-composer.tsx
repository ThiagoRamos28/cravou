"use client";

import { useState, useRef, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { publicarPost } from "@/app/feed/actions";
import type { PerfilBasico } from "@/lib/feed";

type Jogo = { id: string; time_casa: string; time_fora: string };

type PostComposerProps = {
  jogos: Jogo[];
  perfis: PerfilBasico[];
};

export function PostComposer({ jogos, perfis }: PostComposerProps) {
  const [conteudo, setConteudo] = useState("");
  const [jogoId, setJogoId] = useState<string>("");
  const [jogoFiltro, setJogoFiltro] = useState("");
  const [showJogos, setShowJogos] = useState(false);
  const [showMencao, setShowMencao] = useState(false);
  const [filtroMencao, setFiltroMencao] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const restantes = 140 - conteudo.length;

  const jogosFiltrados = jogos.filter(
    (j) =>
      jogoFiltro === "" ||
      j.time_casa.toLowerCase().includes(jogoFiltro.toLowerCase()) ||
      j.time_fora.toLowerCase().includes(jogoFiltro.toLowerCase())
  );

  const perfisFiltrados = perfis
    .filter((p) => p.apelido.toLowerCase().startsWith(filtroMencao.toLowerCase()))
    .slice(0, 5);

  const jogoSelecionado = jogos.find((j) => j.id === jogoId);

  function handleTextareaChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    setConteudo(val);

    const cursorPos = e.target.selectionStart ?? val.length;
    const textAntes = val.slice(0, cursorPos);
    const match = textAntes.match(/@(\w*)$/);
    if (match) {
      setFiltroMencao(match[1]);
      setShowMencao(true);
    } else {
      setShowMencao(false);
    }
  }

  function selecionarMencao(apelido: string) {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const cursorPos = textarea.selectionStart ?? conteudo.length;
    const textAntes = conteudo.slice(0, cursorPos);
    const textDepois = conteudo.slice(cursorPos);
    const novo = textAntes.replace(/@\w*$/, `@${apelido} `) + textDepois;
    setConteudo(novo);
    setShowMencao(false);
    textarea.focus();
  }

  function handleSubmit() {
    setErro(null);
    startTransition(async () => {
      const result = await publicarPost(conteudo, jogoId || undefined);
      if (result.erro) {
        setErro(result.erro);
      } else {
        setConteudo("");
        setJogoId("");
        setJogoFiltro("");
      }
    });
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={conteudo}
          onChange={handleTextareaChange}
          placeholder="O que você tá achando?"
          maxLength={145}
          rows={3}
          className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />

        {showMencao && perfisFiltrados.length > 0 && (
          <div className="absolute left-0 top-full z-10 mt-1 w-64 rounded-xl border border-border bg-card shadow-lg">
            {perfisFiltrados.map((p) => (
              <button
                key={p.id}
                onMouseDown={(e) => {
                  e.preventDefault();
                  selecionarMencao(p.apelido);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted"
              >
                <span className="font-medium">@{p.apelido}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mt-2">
        {!showJogos && !jogoSelecionado && (
          <button
            onClick={() => setShowJogos(true)}
            className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            + Vincular a um jogo
          </button>
        )}

        {jogoSelecionado && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">
              Jogo: {jogoSelecionado.time_casa} × {jogoSelecionado.time_fora}
            </span>
            <button
              onClick={() => { setJogoId(""); setJogoFiltro(""); }}
              className="text-red-500 hover:underline"
            >
              remover
            </button>
          </div>
        )}

        {showJogos && !jogoSelecionado && (
          <div className="mt-2">
            <input
              type="text"
              placeholder="Filtrar por time..."
              value={jogoFiltro}
              onChange={(e) => setJogoFiltro(e.target.value)}
              className="mb-1 w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <div className="max-h-36 overflow-y-auto rounded-xl border border-border">
              {jogosFiltrados.length === 0 && (
                <p className="px-3 py-2 text-xs text-muted-foreground">
                  Nenhum jogo encontrado.
                </p>
              )}
              {jogosFiltrados.map((j) => (
                <button
                  key={j.id}
                  onClick={() => {
                    setJogoId(j.id);
                    setShowJogos(false);
                  }}
                  className="flex w-full px-3 py-2 text-left text-xs hover:bg-muted"
                >
                  {j.time_casa} × {j.time_fora}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between">
        <span
          className={`text-xs font-medium tabular-nums ${
            restantes <= 20 ? "text-red-500" : "text-muted-foreground"
          }`}
        >
          {restantes}
        </span>
        <Button
          variant="primary"
          size="sm"
          onClick={handleSubmit}
          disabled={isPending || conteudo.trim().length === 0 || restantes < 0}
        >
          {isPending ? "Postando..." : "Postar"}
        </Button>
      </div>

      {erro && (
        <p role="alert" className="mt-2 text-xs text-red-600 dark:text-red-400">
          {erro}
        </p>
      )}
    </div>
  );
}

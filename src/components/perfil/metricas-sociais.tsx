"use client";

import { useState } from "react";
import { FollowersModal } from "./followers-modal";
import type { PerfilBasico } from "@/lib/feed";

type Aba = "seguidores" | "seguindo";

type MetricasSociaisProps = {
  seguidores: number;
  seguindo: number;
  listaSeguidores: PerfilBasico[];
  listaSeguindo: PerfilBasico[];
};

export function MetricasSociais({
  seguidores,
  seguindo,
  listaSeguidores,
  listaSeguindo,
}: MetricasSociaisProps) {
  const [modalAberto, setModalAberto] = useState<Aba | null>(null);

  return (
    <>
      <div className="flex items-center gap-3 text-sm">
        <button
          onClick={() => setModalAberto("seguidores")}
          className="font-medium hover:underline"
        >
          <span className="font-bold">{seguidores}</span>{" "}
          <span className="text-muted-foreground">
            {seguidores === 1 ? "seguidor" : "seguidores"}
          </span>
        </button>
        <span className="text-muted-foreground">·</span>
        <button
          onClick={() => setModalAberto("seguindo")}
          className="font-medium hover:underline"
        >
          <span className="font-bold">{seguindo}</span>{" "}
          <span className="text-muted-foreground">seguindo</span>
        </button>
      </div>

      {modalAberto && (
        <FollowersModal
          seguidores={listaSeguidores}
          seguindo={listaSeguindo}
          abaInicial={modalAberto}
          onClose={() => setModalAberto(null)}
        />
      )}
    </>
  );
}

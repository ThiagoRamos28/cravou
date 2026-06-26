"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "cravou:novidades-perfil-v1";

function marcarVisto() {
  localStorage.setItem(STORAGE_KEY, "visto");
}

export function NovidadesModal() {
  const [visivel, setVisivel] = useState(false);
  const router = useRouter();
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY) !== "visto") {
      setVisivel(true);
    }
  }, []);

  function handleIrPerfil() {
    marcarVisto();
    router.push("/perfil");
  }

  function handleFechar() {
    marcarVisto();
    setVisivel(false);
  }

  function handleOverlay() {
    setVisivel(false);
  }

  return (
    <AnimatePresence>
      {visivel && (
        <motion.div
          initial={reducedMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reducedMotion ? 0 : 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm"
          onClick={handleOverlay}
        >
          <motion.div
            initial={reducedMotion ? false : { opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: reducedMotion ? 0 : 0.2 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl border border-border bg-card p-6"
          >
            <div className="mb-4 flex justify-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Sparkles className="h-6 w-6" aria-hidden="true" />
              </span>
            </div>
            <h2 className="mb-2 text-center font-display text-xl font-bold uppercase tracking-tight">
              Novidade no Cravou!
            </h2>
            <p className="mb-6 text-center text-sm text-muted-foreground">
              Agora você pode alterar seu avatar, apelido e senha acessando o
              seu perfil de usuário.
            </p>
            <div className="flex flex-col gap-2">
              <Button
                type="button"
                variant="cta"
                className="w-full"
                onClick={handleIrPerfil}
              >
                Ir para o Perfil
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={handleFechar}
              >
                Entendi
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

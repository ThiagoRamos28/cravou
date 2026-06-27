"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { alternarFollow } from "@/app/feed/actions";

type FollowButtonProps = {
  followingId: string;
  isSeguindoInicial: boolean;
};

export function FollowButton({ followingId, isSeguindoInicial }: FollowButtonProps) {
  const [isSeguindo, setIsSeguindo] = useState(isSeguindoInicial);
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    setIsSeguindo((v) => !v);
    startTransition(async () => {
      await alternarFollow(followingId);
    });
  }

  return (
    <Button
      variant={isSeguindo ? "outline" : "primary"}
      size="sm"
      onClick={handleClick}
      disabled={isPending}
    >
      {isSeguindo ? "Deixar de seguir" : "Seguir"}
    </Button>
  );
}

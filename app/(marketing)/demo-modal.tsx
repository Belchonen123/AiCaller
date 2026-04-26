"use client";

import { PlayCircleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function DemoVideoButton() {
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="secondary" size="lg" />}>
        <PlayCircleIcon />
        See it work in 2 minutes
      </DialogTrigger>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Actualizer product walkthrough</DialogTitle>
          <DialogDescription>
            Demo video placeholder. This will show an incoming call becoming a structured Michigan Home Help intake packet.
          </DialogDescription>
        </DialogHeader>
        <div className="grid aspect-video place-items-center rounded-xl bg-bg-emphasis">
          <PlayCircleIcon className="size-16 text-accent-primary" />
        </div>
      </DialogContent>
    </Dialog>
  );
}

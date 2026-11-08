import { setupWorker } from "msw/browser";
import { handlers } from "./handlers";

export const worker = setupWorker(...handlers);
let starting: ReturnType<typeof worker.start> | undefined;
export function enableMocking() {
  starting ??= worker.start({ onUnhandledFrame: "bypass" }).catch((error) => {
    starting = undefined;
    throw error;
  });
  return starting;
}

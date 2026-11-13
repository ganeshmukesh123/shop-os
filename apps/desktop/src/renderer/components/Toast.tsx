import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { Toast } from "radix-ui";
import { Callout } from "@radix-ui/themes";

type Kind = "success" | "error";
interface Msg {
  id: number;
  kind: Kind;
  text: string;
}
const Ctx = createContext<(kind: Kind, text: string) => void>(() => {});
export const useToast = () => useContext(Ctx);

/** Global toast host. Kind is always spelled out in text ("Error:"), never colour alone. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const push = useCallback((kind: Kind, text: string) => {
    setMsgs((previousMessages) => [
      ...previousMessages,
      { id: Date.now() + Math.random(), kind, text },
    ]);
  }, []);
  return (
    <Ctx.Provider value={push}>
      <Toast.Provider swipeDirection="right" duration={TOAST_DURATION_MILLISECONDS}>
        {children}
        {msgs.map((toastMessage) => (
          <Toast.Root
            key={toastMessage.id}
            duration={toastMessage.kind === "error" ? 10000 : 3500}
            onOpenChange={(isOpen) =>
              !isOpen &&
              setMsgs((previousMessages) =>
                previousMessages.filter((otherMessage) => otherMessage.id !== toastMessage.id),
              )
            }
            style={{ listStyle: "none" }}
          >
            <Callout.Root
              color={toastMessage.kind === "error" ? "red" : "green"}
              size="2"
              role={toastMessage.kind === "error" ? "alert" : "status"}
            >
              <Callout.Text>
                <Toast.Title style={{ fontWeight: 600 }}>
                  {toastMessage.kind === "error" ? "Error: " : "Done: "}
                </Toast.Title>
                <Toast.Description asChild>
                  <span>{toastMessage.text}</span>
                </Toast.Description>
              </Callout.Text>
            </Callout.Root>
          </Toast.Root>
        ))}
        <Toast.Viewport
          style={{
            position: "fixed",
            bottom: 16,
            right: 16,
            display: "flex",
            flexDirection: "column",
            gap: 8,
            width: 380,
            maxWidth: "90vw",
            zIndex: 1000,
            margin: 0,
            padding: 0,
          }}
        />
      </Toast.Provider>
    </Ctx.Provider>
  );
}
const TOAST_DURATION_MILLISECONDS = 5000;

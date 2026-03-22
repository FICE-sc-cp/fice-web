import { useContext } from "react";
import { TelegramCtx } from "../components/TelegramProvider";

export function useTelegram() {
    return useContext(TelegramCtx);
}
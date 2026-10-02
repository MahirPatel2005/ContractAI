const controllers = new Map<string, AbortController>();

export function registerChatAbort(chatId: string): AbortController {
  // Cancel previous if still running
  const prev = controllers.get(chatId);
  if (prev) {
    prev.abort();
  }
  const controller = new AbortController();
  controllers.set(chatId, controller);
  return controller;
}

export function cancelChat(chatId: string): boolean {
  const controller = controllers.get(chatId);
  if (controller) {
    controller.abort();
    controllers.delete(chatId);
    return true;
  }
  return false;
}

export function unregisterChatAbort(chatId: string) {
  controllers.delete(chatId);
}

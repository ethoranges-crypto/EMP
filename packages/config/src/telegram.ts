/**
 * Telegram's actual bot-username rules: 5-32 characters, starts with a
 * letter, only letters/digits/underscores, must end in "bot" (case
 * insensitive). This can only catch an obviously-fake or unset value
 * ("placeholder", "", "your_bot_username") — it can't confirm a specific
 * username belongs to a real, running bot (that needs a live getMe() call
 * against the Bot API), so a syntactically valid but non-existent username
 * (e.g. a leftover dev placeholder like "EmpDevBot") still passes. That's
 * the honest limit of a format check done without network access.
 */
export function isValidTelegramBotUsername(username: string): boolean {
  if (username.length < 5 || username.length > 32) return false;
  return /^[A-Za-z][A-Za-z0-9_]*[Bb]ot$/.test(username);
}

#!/bin/sh
# Saves your Anthropic API key to .env (gitignored, chmod 600) without echoing it, then checks it works.
# Usage: sh scripts/set-key.sh
cd "$(dirname "$0")/.." || exit 1
printf 'Paste your Anthropic API key (input is hidden), then press Enter: '
stty -echo 2>/dev/null
IFS= read -r key
stty echo 2>/dev/null
printf '\n'
key=$(printf '%s' "$key" | tr -d '[:space:]')
case "$key" in
  sk-ant-*) ;;
  "") echo "No key entered. Nothing saved."; exit 1 ;;
  *) echo "That doesn't look like an Anthropic key (it should start with sk-ant-). Nothing saved."; exit 1 ;;
esac
umask 077
{
  printf 'ANTHROPIC_API_KEY=%s\n' "$key"
  printf 'CONSENTRY_MODEL=claude-opus-5-5\n'
  printf 'CONSENTRY_EFFORT=low\n'
} > .env
chmod 600 .env
code=$(curl -s -o /dev/null -w '%{http_code}' https://api.anthropic.com/v1/models -H "x-api-key: $key" -H 'anthropic-version: 2023-06-01')
unset key
if [ "$code" = "200" ]; then
  echo "✓ Saved to .env and the key works. Go back to the chat and say: done"
else
  echo "Saved to .env, but Anthropic answered HTTP $code. Double-check the key, then run this again."
fi

# Security policy

Consentry is a privacy tool, so we take bypasses seriously.

## Reporting

Please open a [private security advisory](https://github.com/vnmoorthy/consentry/security/advisories/new) rather than a public issue. Include:

- the payload or scenario (ideally as a failing `vitest` case in `packages/core/test/`)
- which layer you bypassed (detection, policy, egress, ingress, LLM tokenization, ledger)
- expected vs. actual behavior

## In scope

- Personal data leaving the runtime in a form the active policy doesn't allow
- Prompt-injection payloads that survive ingress quarantine at score ≥ 0.4
- Ledger entries that can be altered without `verify()` failing
- Vault or chat plaintext appearing on disk

## Known limitations (not vulnerabilities)

See "Security model & honest limitations" in the README: semantic paraphrase, encoded exfiltration to *trusted* recipients, and local-only ledger re-sealing.

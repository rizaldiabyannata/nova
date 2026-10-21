# Security Policy

## Reporting a vulnerability

Please **do not open a public issue**. Use GitHub's [private vulnerability reporting](https://github.com/rizaldiabyannata/nova/security/advisories/new) or email **aldizar255@gmail.com**.

Include what you found, how to reproduce it, and its impact. You will get a reply within a week.

## Scope

Of most interest: anything that could leak the AI provider Admin keys (kept in the system keyring and only sent by the Rust shell), write secrets to logs, or let a web page or clipboard content run code in the Nova window.

Only the latest `main` is supported.

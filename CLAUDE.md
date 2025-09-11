# MANDATORY INITIALIZATION - DO THIS IMMEDIATELY

## ⚠️ STOP - READ THIS FIRST ⚠️

**YOU MUST READ THESE DOCUMENTS IMMEDIATELY UPON STARTING ANY CONVERSATION ABOUT THIS PROJECT.**
**DO NOT WAIT TO BE ASKED. DO NOT PROCEED WITHOUT READING THEM FIRST.**

### Required Documents (READ NOW):
1. `docs/TESTING-PHILOSOPHY.md` - Critical testing patterns and approaches
2. `docs/ARCHITECTURE.md` - Clean/Hexagonal Architecture structure
3. `docs/ERROR-HANDLING.md` - Error handling patterns and presentation conventions

### Verification Checklist:
- [ ] I have read `docs/TESTING-PHILOSOPHY.md` completely
- [ ] I have read `docs/ARCHITECTURE.md` completely
- [ ] I have read `docs/ERROR-HANDLING.md` completely
- [ ] I understand the testing philosophy (integration focus, proper mocking, behavior testing)
- [ ] I understand the architecture layers (Domain, Application, Infrastructure, Presentation)
- [ ] I understand error handling patterns (typed errors, emoji prefixes, separation of concerns)

If you haven't read these documents yet, STOP and read them now using the Read tool.
Only after reading all three documents should you proceed to help the user.

## Project Context

This is an MCP (Model Context Protocol) server for Xcode operations. The codebase follows:
- Clean/Hexagonal Architecture principles
- Integration-focused testing (60% integration, 25% unit, 10% E2E, 5% static)
- Parse-don't-validate pattern with Zod schemas
- Domain primitives over primitive types
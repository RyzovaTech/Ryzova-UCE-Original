# Go and PHP live repository validation — 2026-10-09

Both repositories completed the production UCE flow: URL input, GitHub archive retrieval, browser scan, and rendered report. Companion CLI scans used pinned source checkouts without running repository code or dependency scripts.

| Repository | Pinned local checkout | Corrected observations |
| --- | --- | --- |
| spf13/cobra | `adbc8813901bba65827259daa8e22ff94ec1f30e` | Windows help text mentioning `cmd.exe` was reported as a platform command |
| Seldaek/monolog | `3bed304b1905fed5c30d172872f4d890cbb03c6a` | A comment path was reported as executable platform evidence; Composer root config and explicit `config.lock: false` were ignored; `phpunit.xml.dist` coverage configuration was unread |

Local before/after rescans removed one Cobra finding and four Monolog findings, with no added compatibility/extended finding IDs. Go `exec.Command` and `exec.CommandContext` calls and executable PHP path literals remain reviewable. Missing Composer lockfiles still produce findings without a boolean opt-out. PHPUnit XML comments, CDATA and test fixtures cannot establish project coverage configuration. Coverage configuration recognition does not prove tests ran or establish a coverage percentage.

Monolog's `.gitattributes` excludes tests, dotfiles and `phpunit.xml.dist` from Git archives. Consequently, its live archive and local checkout have different evidence. The PHPUnit correction applies when the file is supplied; the live archive cannot establish its presence. GitHub reports now explicitly describe export-ignore limitations instead of implying missing archive paths are necessarily missing from the complete repository. No arbitrary suppression of remaining archive findings was added.

Seven new regression tests cover these positive and negative cases, including ZIP extraction of PHPUnit distributed XML. The analysis cache is version 20, and extended intelligence is 3.5.3. This targeted validation does not establish global detection accuracy or certify either repository's runtime behavior.

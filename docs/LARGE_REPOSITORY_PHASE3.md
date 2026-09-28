# Large archive scan: phase 3

UCE scans public GitHub ZIPs locally in an analysis worker. GitHub archive downloads can be written to private browser storage, or to a file selected by the user when the browser supports the File System Access picker. No uploaded source is sent to UCE for analysis; GitHub downloads use the same-origin relay. A selected ZIP stays at the selected location after a successful download. A cancelled or incomplete download aborts its writer.

The seekable reader finds the ZIP central directory in the archive tail. It reads central metadata and selected file content from 32 KiB Blob slices, supports ZIP64 offsets and entries, STORE and DEFLATE, and validates entry length and CRC32 before analysis. It rejects unsafe names, encrypted entries, unsupported compression, out-of-bounds offsets and invalid central directories. The previous JSZip path is retained only for archives at most 64 MiB on browsers without `deflate-raw` streams.

Limits remain explicit: compressed ZIP <= 2 GiB, central directory <= 512 MiB and <= 1,000,000 entries, analyzable uncompressed total <= 5 GiB, maximum 25,000 selected files, maximum 96 MiB of source text and 2 MiB per text file. A report with content or file sampling is marked truncated; reading compressed data in chunks does not imply a complete Linux scan. ZIP central directory indexing requires the full download first. File picker support varies by browser; private storage and the bounded memory path remain available.

For a larger tree, use the CLI or scan a smaller project/subtree until a multi-batch analysis architecture and its accuracy gates are implemented.

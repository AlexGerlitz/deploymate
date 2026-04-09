#!/usr/bin/env sh

set -eu

helper="node_modules/node-pty/prebuilds/darwin-arm64/spawn-helper"

if [ "$(uname -s)" != "Darwin" ]; then
  exit 0
fi

if [ -f "$helper" ]; then
  chmod +x "$helper"
fi

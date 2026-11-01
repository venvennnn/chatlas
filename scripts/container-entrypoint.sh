#!/bin/sh
set -eu
# Railway mounts volumes after image build; a new mount is owned by root.
# Initialize only the mount directory, then run the application as node.
if [ "$(id -u)" = "0" ]; then
  mkdir -p /data
  chown node:node /data
  exec gosu node "$@"
fi
exec "$@"

import sys

path = "/opt/1panel/apps/caddy/caddy/data/conf/Caddyfile"
with open(path) as f:
    content = f.read()

old = "test.card.zmer.top {\n\tencode zstd gzip\n\troot * /srv/test.card.zmer.top\n\ttry_files {path} /index.html\n\tfile_server\n}"

new = "test.card.zmer.top {\n\tencode zstd gzip\n\thandle /api/* {\n\t\treverse_proxy 127.0.0.1:8421\n\t}\n\thandle {\n\t\troot * /srv/test.card.zmer.top\n\t\ttry_files {path} /index.html\n\t\tfile_server\n\t}\n}"

if old not in content:
    # Try with spaces instead of tabs
    old2 = old.replace("\t", "    ")
    new2 = new.replace("\t", "    ")
    if old2 not in content:
        print("OLD BLOCK NOT FOUND")
        sys.exit(1)
    content = content.replace(old2, new2)
else:
    content = content.replace(old, new)

with open(path, "w") as f:
    f.write(content)
print("OK - Caddyfile updated")

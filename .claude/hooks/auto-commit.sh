#!/bin/sh
# Hook Stop: al terminar cada respuesta de Claude, commitea los cambios pendientes.
# ponytail: mensaje inferido por rutas; para mensajes ricos, commitear a mano antes.
cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
[ -z "$(git status --porcelain)" ] && exit 0

# Nunca commitear directo a main: el trabajo va por rama + PR.
branch=$(git branch --show-current)
if [ "$branch" = "main" ] || [ "$branch" = "master" ]; then
  echo "auto-commit: en $branch, no commiteo. Crea una rama." >&2
  exit 0
fi

git add -A
# Seguridad: nunca commitear secretos aunque .gitignore falle.
if git diff --cached --name-only | grep -qE '(^|/)\.env($|\.)|\.pem$|\.key$|credentials'; then
  git reset -q
  echo "auto-commit: archivos sensibles detectados, commit cancelado." >&2
  exit 0
fi

files=$(git diff --cached --name-only)
n=$(echo "$files" | wc -l | tr -d ' ')
# test solo si TODOS los archivos son tests
echo "$files" | grep -qvE '(\.test\.|^tests?/|-compat\.)' || type=test
if echo "$files" | grep -qvE '\.md$|^docs/'; then
  if echo "$files" | grep -qE '^data/'; then type=${type:-data}; else type=${type:-chore}; fi
else
  type=docs
fi
[ "$type" = data ] && type="chore(data)"
list=$(echo "$files" | head -3 | tr '\n' ' ' | sed 's/ $//')
[ "$n" -gt 3 ] && list="$list y $((n - 3)) más"

git commit -q -F - <<MSG
$type: actualizar $list

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
echo "auto-commit: $(git log --oneline -1)" >&2
exit 0

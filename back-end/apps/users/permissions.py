from rest_framework.permissions import SAFE_METHODS, BasePermission


class ReadOnlyOrStaff(BasePermission):
    """Permissão padrão PROVISÓRIA da API (PLANO.md §7.1 — ADR de papéis pendente).

    Regras:
    - SAFE_METHODS (GET/HEAD/OPTIONS): leitura aberta — placar e conteúdo do
      jogo são públicos (objetivo "placar ao vivo sem login").
    - escrita (POST/PUT/PATCH/DELETE): apenas usuário autenticado com
      ``is_staff`` (conta de professor).

    Consequências enquanto o ADR não sai:
    - visitante: lê tudo, não escreve (401/403 nas escritas);
    - aluno logado (JWT): lê tudo, escreve 403;
    - professor (staff): escreve.

    Qualquer view pode sobrescrever com ``permission_classes``.
    """

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        user = request.user
        return bool(user and user.is_authenticated and user.is_staff)

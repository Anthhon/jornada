from rest_framework.permissions import SAFE_METHODS, BasePermission


def is_teacher(user):
    """Professor/admin = usuário ativo que NÃO é aluno (ou é staff).

    Regra do front-end.md: usuário sem registro de ``Student`` é interpretado
    como professor/admin. Quem tem ``Student`` só é professor se for staff.
    """
    if not (user and user.is_authenticated and user.is_active):
        return False
    return user.is_staff or not hasattr(user, "student")


def student_in_group(user, group_id):
    """True se ``user`` é um aluno ativo membro do grupo ``group_id``."""
    if not (user and user.is_authenticated):
        return False
    student = getattr(user, "student", None)
    return bool(student and student.is_active and student.group_id == group_id)


class ReadOnlyOrStaff(BasePermission):
    """Permissão padrão da API.

    - GET/HEAD/OPTIONS: aberta (placar e conteúdo do jogo são públicos);
    - POST/PUT/PATCH/DELETE: só professor (``is_teacher``).

    Qualquer view pode sobrescrever com ``permission_classes``.
    """

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        return is_teacher(request.user)


class IsTeacher(BasePermission):
    """Leitura e escrita só para professor/admin."""

    def has_permission(self, request, view):
        return is_teacher(request.user)


class AuthenticatedReadTeacherWrite(BasePermission):
    """Leitura para qualquer logado (a view restringe o que o aluno enxerga);
    escrita só professor. Usada onde há dados pessoais (alunos)."""

    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated):
            return False
        if request.method in SAFE_METHODS:
            return True
        return is_teacher(user)

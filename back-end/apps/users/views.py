import secrets
import unicodedata

from django.contrib.auth.models import User
from django.db import transaction
from django.utils.text import slugify
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Student
from .permissions import AuthenticatedReadTeacherWrite, IsTeacher, is_teacher
from .serializers import (
    StudentBulkSerializer,
    StudentSerializer,
    UserAdminSerializer,
    UserSerializer,
)

# Sem caracteres ambíguos (0/O, 1/l/I) — a senha é repassada em papel/voz.
_PASSWORD_ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def _new_password(size=8):
    return "".join(secrets.choice(_PASSWORD_ALPHABET) for _ in range(size))


def _new_username(name):
    """username a partir do nome ('João Silva' -> 'joao.silva'), único."""
    ascii_name = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    base = slugify(ascii_name).replace("-", ".")[:140] or "aluno"
    username, n = base, 1
    while User.objects.filter(username=username).exists():
        n += 1
        username = f"{base}{n}"
    return username


@extend_schema(responses=OpenApiTypes.OBJECT)
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def me(request):
    """Quem sou eu: o front usa ``role`` para decidir o que mostrar."""
    user = request.user
    student = getattr(user, 'student', None)
    return Response({
        **UserSerializer(user).data,
        'role': 'teacher' if is_teacher(user) else 'student',
        'student': StudentSerializer(student).data if student else None,
    })


class UserViewSet(viewsets.ModelViewSet):
    """CRUD de usuários — só professor. DELETE desativa (não apaga)."""

    queryset = User.objects.all().order_by('-date_joined')
    serializer_class = UserAdminSerializer
    permission_classes = [IsTeacher]

    def perform_destroy(self, instance):
        if instance.pk == self.request.user.pk:
            raise ValidationError({'detail': 'Você não pode desativar a si mesmo.'})
        instance.is_active = False
        instance.save(update_fields=['is_active'])


class StudentViewSet(viewsets.ModelViewSet):
    """CRUD dos alunos (vinculáveis a um User e a uma equipe).

    - Professor: vê e edita todos. Filtros: ``?group=<id>``, ``?active=true|false``.
    - Aluno: só enxerga o próprio perfil.
    - Visitante: 401.
    """

    queryset = Student.objects.select_related('user', 'group')
    serializer_class = StudentSerializer
    permission_classes = [AuthenticatedReadTeacherWrite]

    def get_queryset(self):
        qs = super().get_queryset()
        if not is_teacher(self.request.user):
            return qs.filter(user=self.request.user)
        params = self.request.query_params
        if params.get('group') is not None:
            qs = qs.filter(group_id=params['group'])
        if params.get('active') is not None:
            qs = qs.filter(is_active=params['active'].lower() in ('1', 'true', 'yes'))
        return qs

    @extend_schema(request=StudentBulkSerializer, responses=OpenApiTypes.OBJECT)
    @action(detail=False, methods=['post'], url_path='bulk')
    def bulk(self, request):
        """Cria vários alunos de uma vez, cada um com login e senha gerados.

        Corpo: ``{"names": ["Ana Souza", ...], "group": <id opcional>}``.
        Resposta: só o que o professor precisa repassar —
        ``[{"id", "name", "username", "password"}]``. A senha só aparece aqui.
        """
        data = StudentBulkSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        group = data.validated_data.get('group')

        created = []
        with transaction.atomic():
            for name in data.validated_data['names']:
                password = _new_password()
                user = User.objects.create_user(
                    username=_new_username(name), password=password
                )
                student = Student.objects.create(name=name, user=user, group=group)
                created.append({
                    'id': student.id,
                    'name': student.name,
                    'username': user.username,
                    'password': password,
                })
        return Response(created, status=status.HTTP_201_CREATED)

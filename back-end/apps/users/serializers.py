from django.contrib.auth.models import Group, User
from django.core.validators import RegexValidator
from rest_framework import serializers
from rest_framework.validators import UniqueValidator
from apps.groups.models import Group as TeamGroup
from .models import Profile, Student

# Convert objects into JSON responses

MATRICULA_VALIDADOR = RegexValidator(
    regex=r"^[0-9]{6}$",
    message="A matrícula deve ter exatamente 6 dígitos.",
)

class ProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = Profile
        fields = '__all__'

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'date_joined']

class GroupSerializer(serializers.ModelSerializer):
    class Meta:
        model = Group
        fields = '__all__'


class UserAdminSerializer(serializers.ModelSerializer):
    """CRUD de usuários (professor/admin). ``password`` só de escrita."""

    password = serializers.CharField(write_only=True, required=False, min_length=8)

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name',
            'is_active', 'is_staff', 'date_joined', 'password',
        ]
        read_only_fields = ['date_joined']

    def create(self, validated_data):
        password = validated_data.pop('password', None)
        user = User(**validated_data)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save()
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        user = super().update(instance, validated_data)
        if password:
            user.set_password(password)
            user.save(update_fields=['password'])
        return user


class StudentSerializer(serializers.ModelSerializer):
    """CRUD dos alunos.

    Campos aninhados de leitura (``username``/``group_name``) vêm de FKs
    opcionais, por isso SerializerMethodField: ``user`` e ``group`` podem ser
    ``None`` e o método trata isso sem depender do comportamento do DRF com
    ``source`` aninhado nulo.

    Desativar um aluno (``is_active=false``) também desativa o login dele.
    """

    username = serializers.SerializerMethodField()
    group_name = serializers.SerializerMethodField()
    # Obrigatória na criação: exatamente 6 dígitos e única na turma.
    matricula = serializers.CharField(
        max_length=6,
        error_messages={"blank": "Informe a matrícula."},
        validators=[
            MATRICULA_VALIDADOR,
            UniqueValidator(
                queryset=Student.objects.all(),
                message="Já existe um aluno com esta matrícula.",
            ),
        ],
    )

    class Meta:
        model = Student
        fields = [
            'id',
            'name',
            'matricula',
            'user',
            'username',
            'group',
            'group_name',
            'grade',
            'is_active',
            'created_at',
        ]
        read_only_fields = ['created_at']

    def get_username(self, obj):
        return obj.user.username if obj.user else None

    def get_group_name(self, obj):
        return obj.group.name if obj.group else None

    def update(self, instance, validated_data):
        student = super().update(instance, validated_data)
        if 'is_active' in validated_data and student.user is not None:
            student.user.is_active = validated_data['is_active']
            student.user.save(update_fields=['is_active'])
        return student


class BulkStudentItemSerializer(serializers.Serializer):
    """Um aluno da criação em lote: nome + matrícula obrigatória (6 dígitos)."""

    name = serializers.CharField(max_length=100)
    matricula = serializers.CharField(
        max_length=6,
        error_messages={"blank": "Informe a matrícula."},
        validators=[MATRICULA_VALIDADOR],
    )


class StudentBulkSerializer(serializers.Serializer):
    """Entrada da criação em lote: cada aluno com nome E matrícula.

    Corpo: ``{"students": [{"name": "...", "matricula": "123456"}, ...],
    "group": <id opcional>}``.
    """

    students = serializers.ListField(
        child=BulkStudentItemSerializer(),
        allow_empty=False,
        max_length=500,
    )
    group = serializers.PrimaryKeyRelatedField(
        queryset=TeamGroup.objects.all(),
        required=False,
        allow_null=True,
    )

    def validate_students(self, value):
        itens = []
        vistos = set()
        for item in value:
            name = item["name"].strip()
            matricula = item["matricula"].strip()
            if not name:
                raise serializers.ValidationError('Informe ao menos um nome.')
            if matricula in vistos:
                raise serializers.ValidationError(
                    f'Matrícula {matricula} repetida no lote.'
                )
            vistos.add(matricula)
            itens.append({"name": name, "matricula": matricula})

        # Matrícula já existente no banco (a unicidade também está no model).
        ja_cadastradas = set(
            Student.objects.filter(matricula__in=vistos)
            .values_list("matricula", flat=True)
        )
        if ja_cadastradas:
            raise serializers.ValidationError(
                'Matrícula já cadastrada: ' + ', '.join(sorted(ja_cadastradas)) + '.'
            )
        return itens

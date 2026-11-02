from django.contrib.auth.models import Group, User
from rest_framework import serializers
from apps.groups.models import Group as TeamGroup
from .models import Profile, Student

# Convert objects into JSON responses

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

    class Meta:
        model = Student
        fields = [
            'id',
            'name',
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


class StudentBulkSerializer(serializers.Serializer):
    """Entrada da criação em lote: só nomes (e, opcionalmente, o grupo)."""

    names = serializers.ListField(
        child=serializers.CharField(max_length=100),
        allow_empty=False,
        max_length=500,
    )
    group = serializers.PrimaryKeyRelatedField(
        queryset=TeamGroup.objects.all(),
        required=False,
        allow_null=True,
    )

    def validate_names(self, value):
        cleaned = [n.strip() for n in value if n.strip()]
        if not cleaned:
            raise serializers.ValidationError('Informe ao menos um nome.')
        return cleaned

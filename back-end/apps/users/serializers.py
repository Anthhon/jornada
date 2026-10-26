from django.contrib.auth.models import Group, User
from rest_framework import serializers
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


class StudentSerializer(serializers.ModelSerializer):
    """CRUD dos alunos.

    Campos aninhados de leitura (``username``/``group_name``) vêm de FKs
    opcionais, por isso SerializerMethodField: ``user`` e ``group`` podem ser
    ``None`` e o método trata isso sem depender do comportamento do DRF com
    ``source`` aninhado nulo.
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
            'created_at',
        ]
        read_only_fields = ['created_at']

    def get_username(self, obj):
        return obj.user.username if obj.user else None

    def get_group_name(self, obj):
        return obj.group.name if obj.group else None

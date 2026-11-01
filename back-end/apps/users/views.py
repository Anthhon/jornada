from django.contrib.auth.models import Group, User
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import viewsets
from django.shortcuts import render
from .models import Profile, Student
from .serializers import (
        ProfileSerializer,
        GroupSerializer,
        UserSerializer,
        StudentSerializer,
)

# Define all views related to Profile, User or Group

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def user_list(request):
    # Get all users
    users = User.objects.all().order_by('-date_joined')
    # Serialize all 'users' info
    users_serialized = UserSerializer(users, many=True)
    # Return all serialized info
    return Response(users_serialized.data)


class StudentViewSet(viewsets.ModelViewSet):
    """CRUD dos alunos (vinculáveis a um User e a uma equipe).

    Filtro opcional: ``GET /api/students/?group=<id>``.
    """

    queryset = Student.objects.select_related('user', 'group')
    serializer_class = StudentSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        group_id = self.request.query_params.get('group')
        if group_id is not None:
            qs = qs.filter(group_id=group_id)
        return qs

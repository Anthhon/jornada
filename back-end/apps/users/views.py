from django.contrib.auth.models import Group, User
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.shortcuts import render
from .models import Profile
from .serializers import ProfileSerializer, GroupSerializer, UserSerializer

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

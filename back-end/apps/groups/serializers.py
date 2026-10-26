from rest_framework import serializers
from .models import Group

class GroupSerializer(serializers.ModelSerializer):
    member_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Group
        fields = ['id', 'name', 'points', 'created_at', 'member_count']
        read_only_fields = ['points', 'created_at', 'member_count']

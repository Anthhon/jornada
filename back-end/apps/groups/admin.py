from django.contrib import admin

from .models import Group


@admin.register(Group)
class GroupAdmin(admin.ModelAdmin):
    list_display = ("name", "points", "member_count", "created_at")
    search_fields = ("name",)

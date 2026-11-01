from django.contrib import admin

from .models import Profile, Student


@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "created_at", "updated_at")
    search_fields = ("user__username",)


@admin.register(Student)
class StudentAdmin(admin.ModelAdmin):
    list_display = ("name", "group", "user", "created_at")
    list_filter = ("group",)
    search_fields = ("name", "user__username")

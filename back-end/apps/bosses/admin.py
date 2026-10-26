from django.contrib import admin

from .models import Boss, BossSpell, Choice, Question


@admin.register(Boss)
class BossAdmin(admin.ModelAdmin):
    list_display = ("name", "max_hp")
    search_fields = ("name",)
    # Sem filter_horizontal: Boss.spells tem through (BossSpell) — pesos são
    # editados em BossSpellAdmin.


@admin.register(BossSpell)
class BossSpellAdmin(admin.ModelAdmin):
    list_display = ("boss", "spell", "weight")
    list_filter = ("boss",)
    autocomplete_fields = ("boss", "spell")


@admin.register(Question)
class QuestionAdmin(admin.ModelAdmin):
    list_display = ("text", "boss", "points")
    list_filter = ("boss",)
    search_fields = ("text",)


@admin.register(Choice)
class ChoiceAdmin(admin.ModelAdmin):
    list_display = ("text", "question", "is_correct")
    list_filter = ("is_correct",)
    search_fields = ("text",)

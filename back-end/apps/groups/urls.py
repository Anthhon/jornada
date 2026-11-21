from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import GroupViewSet, LeaderboardView, TeamAbilityTemplateViewSet

router = DefaultRouter()
router.register(r"api/groups", GroupViewSet, basename="group")
router.register(r"api/team-abilities", TeamAbilityTemplateViewSet, basename="team-ability")

urlpatterns = [
    path("api/leaderboard/", LeaderboardView.as_view(), name="leaderboard"),
] + router.urls

from rest_framework.routers import DefaultRouter

from .views import BossViewSet, BossSpellViewSet, ChoiceViewSet, QuestionViewSet

router = DefaultRouter()
router.register(r"api/bosses", BossViewSet, basename="boss")
router.register(r"api/boss-spells", BossSpellViewSet, basename="boss-spell")
router.register(r"api/questions", QuestionViewSet, basename="question")
router.register(r"api/choices", ChoiceViewSet, basename="choice")

urlpatterns = router.urls

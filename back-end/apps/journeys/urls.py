from rest_framework.routers import DefaultRouter

from .views import (
    BattleEventViewSet,
    GroupJourneyViewSet,
    JourneyViewSet,
    StageProgressViewSet,
    StageViewSet,
)

router = DefaultRouter()
router.register(r"api/journeys", JourneyViewSet, basename="journey")
router.register(r"api/stages", StageViewSet, basename="stage")
router.register(r"api/group-journeys", GroupJourneyViewSet, basename="group-journey")
router.register(r"api/stage-progress", StageProgressViewSet, basename="stage-progress")
router.register(r"api/battle-events", BattleEventViewSet, basename="battle-event")

urlpatterns = router.urls

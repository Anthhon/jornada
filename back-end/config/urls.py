from django.contrib import admin
from django.urls import path, include
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

urlpatterns = [
        # Default admin page
        path('admin/', admin.site.urls),

        # Users related views (user_list + api/students/)
        path('', include('apps.users.urls')),

        # Game resources CRUD (DRF routers por app)
        path('', include('apps.groups.urls')),      # api/groups/
        path('', include('apps.spells.urls')),      # api/spells/
        path('', include('apps.heroes.urls')),      # api/heroes/
        path('', include('apps.bosses.urls')),      # api/bosses/ boss-spells/ questions/ choices/
        path('', include('apps.journeys.urls')),    # api/journeys/ stages/ group-journeys/ stage-progress/ battle-events/

        # Login tokens
        path('api/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
        path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
        ]

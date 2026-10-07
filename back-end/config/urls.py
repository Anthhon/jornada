from django.contrib import admin
from django.urls import path, include
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

urlpatterns = [
        # Default admin page
        path('admin/', admin.site.urls),

        # Users related views
        path('', include('apps.users.urls')),

        # Groups related views
        path('', include('apps.groups.urls')),

        # Login tokens
        path('api/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
        path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
        ]      

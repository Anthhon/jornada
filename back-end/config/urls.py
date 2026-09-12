from django.contrib import admin
from django.urls import path, include

urlpatterns = [
        # Default admin page
        path('admin/', admin.site.urls),

        # Users related views
        path('', include('apps.users.urls')),
        ]

from django.urls import path
from . import views

urlpatterns = [
        path('api/users/', views.user_list, name='users_list'),
        ]

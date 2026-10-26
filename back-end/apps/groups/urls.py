from django.urls import path
from . import views

urlpatterns = [
    path('api/groups/', views.group_list_create, name='group_list_create'),
    path('api/groups/<int:pk>/', views.group_detail, name='group_detail'),
]

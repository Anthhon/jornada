from django.db import models

# Defines the Group and Student models and their relationship
class Group(models.Model):
    name = models.CharField(max_length=100, unique=True)

    def __str__(self):
        return self.name

class Student(models.Model):
    name = models.CharField(max_length=100)
    group = models.ForeignKey(Group,related_name='students',on_delete=models.CASCADE)

    def __str__(self):
        return self.name
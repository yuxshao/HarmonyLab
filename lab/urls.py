from django.conf.urls import patterns, url
import views
from views import PlayView, ExerciseView, ManageView
from views import APIView, APIExerciseView, APIGroupView
from views import LTIToolConfigView, LTILaunchView

urlpatterns = patterns(
    '',
    url(r'^$', PlayView.as_view(), name='index'),

    # Course Exercises
    url(r'^courses/(?P<course_id>\d+)/manage$', ManageView.as_view(), name="course-manage"),
    url(r'^courses/(?P<course_id>\d+)/authcheck$', views.check_course_authorization, name="course-authorization-check"),
    url(r'^courses/(?P<course_id>\d+)/exercises/(?P<group_name>[a-zA-Z0-9_\-.]+)/(?P<exercise_name>\d+)$', ExerciseView.as_view(), name="course-exercises"),
    url(r'^courses/(?P<course_id>\d+)/exercises/(?P<group_name>[a-zA-Z0-9_\-.]+)$', ExerciseView.as_view(), name="course-exercise-groups"),
    url(r'^courses/(?P<course_id>\d+)/exercises$', ExerciseView.as_view()),
    url(r'^courses/(?P<course_id>\d+)$', PlayView.as_view(), name="course-index"),

    # Non-Course Exercises
    url(r'^manage$', ManageView.as_view(), name="manage"),
    url(r'^exercises/(?P<group_name>[a-zA-Z0-9_\-.]+)/(?P<exercise_name>\d+)$', ExerciseView.as_view(), name="exercises"),
    url(r'^exercises/(?P<group_name>[a-zA-Z0-9_\-.]+)$', ExerciseView.as_view(), name="exercise-groups"),
    url(r'^exercises$', ExerciseView.as_view()),

    # API 
    url(r'^api$', APIView.as_view(), name="api"),
    url(r'^api/v1/exercises$', APIExerciseView.as_view(), name="api-exercises"),
    url(r'^api/v1/groups$', APIGroupView.as_view(), name="api-groups"),

    # LTI 
    url(r'^lti-launch$', LTILaunchView.as_view(), name='lti-launch'),
    url(r'^lti-config$', LTIToolConfigView.as_view(), name='lti-config'),

    # Logout
    url(r'^logout$', views.logout_view, name="logout"),
    url(r'^logged-out$', views.logged_out_view, name="logged-out"),
)
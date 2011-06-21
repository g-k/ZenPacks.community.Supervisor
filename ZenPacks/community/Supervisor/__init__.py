
import Globals
import os.path

skinsDir = os.path.join(os.path.dirname(__file__), 'skins')
from Products.CMFCore.DirectoryView import registerDirectory
if os.path.isdir(skinsDir):
    registerDirectory(skinsDir, globals())


from Products.ZenModel.ZenossSecurity import ZEN_COMMON
from Products.ZenUtils.Utils import zenPath
from Products.ZenModel.ZenPack import ZenPackBase

class ZenPack(ZenPackBase):
    """
    Portlet ZenPack class
    """

    def _registerPortlet(self, app):
        zpm = app.zport.ZenPortletManager
        portletsrc = os.path.join(os.path.dirname(__file__),
                                  'lib', 'SupervisorStatusPortlet.js')
        print 'Portlet Src:', portletsrc

        zpm.register_portlet(
            sourcepath=portletsrc,
            id='SupervisorStatusPortlet',
            title='Supervisor Status',
            permission=ZEN_COMMON)

    def _add_events(self):
        """Adds the a supervisor worker event class
        TODO: should add event class instances as well
        """

        self.dmd.Events.manage_addOrganizer("/App/Supervisor/Worker")
        # self.dmd.Events.

    def install(self, app):
        """Initial installation of the ZenPack """

        self._add_events()

        ZenPackBase.install(self, app)
        self._registerPortlet(app)

    def upgrade(self, app):
        """ Upgrading the ZenPack procedures """

        self._add_events()

        ZenPackBase.upgrade(self, app)
        self._registerPortlet(app)

    def remove(self, app, leaveObjects=False ):
        """ Remove the ZenPack from Zenoss """
        # NB: As of Zenoss 2.2, this function now takes three arguments.
        ZenPackBase.remove(self, app, leaveObjects)
        zpm = app.zport.ZenPortletManager
        zpm.unregister_portlet('SupervisorStatusPortlet')


from DateTime import DateTime # Zope 2 doesn't use stdlib datetime
import json


def getJSONSupervisorWorkerStatus(self,
                                  lastupdate='',
                                  rows=100,
                                  offset=0,
                                  orderby='lastTime DESC'):
    """Returns a table of nodes and workers with their status
    in JSON for a YUI3 TableDatasource.
    """

    # This function will be monkey-patched onto zport, so
    # self refers to zport
    # There's a monkeypatch decorator for this in ZenUtils

    # >>> print dmd.ZenEventManager.getEventList.__doc__
    #         Fetch a list of events from the database matching certain criteria.
    #         @param resultFields: The columns to return from the database.
    #         @type resultFields: list
    #         @param where: The base where clause to modify.
    #         @type where: string
    #         @param orderby: The "ORDER BY" string governing sort order.
    #         @type orderby: string
    #         @param severity: The minimum severity for which to query.
    #         @type severity: int
    #         @param state: The minimum state for which to query.
    #         @type state: int
    #         @param startdate: The early date limit
    #         @type startdate: string, DateTime
    #         @param enddate: The late date limit
    #         @type enddate: string, DateTime
    #         @param offset: The row at which to begin returning
    #         @type offset: int
    #         @param rows: The number of rows to return.
    #         @type rows: int
    #         @param getTotalCount: Whether or not to return a count of the total
    #             number of rows
    #         @type getTotalCount: bool
    #         @param filter: A glob by which to filter events
    #         @type filter: string
    #         @return: Matching events as L{ZEvent}s.
    #         @rtype: list
    #         @todo: Remove unused parameters from the method definition

    now = DateTime()
    if lastupdate:
        lastupdate = DateTime(lastupdate)

    # Create the empty structure of the response object
    response = { 'columns': ['Device', 'Worker', 'Status', 'Last Updated'],
                 'data': [],
                 'lastupdate': str(now),
                 }

    events = self.dmd.ZenEventManager.getEventList(rows=rows,
                                                   offset=offset,
                                                   orderby='lastTime DESC')

    # Get the most recent event from each worker (unique on component)
    # Should happen in a collector or somewhere else
    workers = {}
    for event in events:

        # SQL query returns strings, which need to be cast as Zope DateTimes
        last_event_time = DateTime(event.lastTime)

        # Stop if we the last time the event occurred was
        # before the last update (i.e. we already have it)
        if lastupdate and last_event_time < lastupdate:
            break

        # Hacks to get the worker
        if 'supervisor' not in event.component:
            continue

        worker_name = str(event.component).split('/')[-1]

        if worker_name not in workers:
            workers[worker_name] = event
        else:
            # Update it if we have a more recent event
            if DateTime(workers[worker_name].lastTime) < last_event_time:
                workers[worker_name] = event

    event_severity_color = {
        5 : '#d60000', # Critical
        4 : '#d60000', # Error
        3 : '#ff9711', # Warning
        2 : 'darkgreen', # Info
        1 : 'darkgreen' , # Debug
        0 : 'darkgreen', # Clear
        }

    # Iterate over the workers, create links to their devices
    for worker_name, event in workers.iteritems():
        device = self.dmd.Devices.findDevice(event.device)
        if device:
            device = '<a href={0}>{1}</a>'.format(
                device.absolute_url_path(), device.title)
        else:
            device = str(event.device)

        row = {
            'Device': device,
            'Worker': worker_name,
            'Status' : '<span style="color:{1}">{0}</span>'.format( \
                event.summary, event_severity_color[int(event.severity)]) ,
            'Last Updated': str(event.lastTime),
            }
        response['data'].append(row)


    # Serialize the response and return it
    return json.dumps(response)

# Monkey-patch onto zport
from Products.ZenModel.ZentinelPortal import ZentinelPortal
ZentinelPortal.getJSONSupervisorWorkerStatus = getJSONSupervisorWorkerStatus

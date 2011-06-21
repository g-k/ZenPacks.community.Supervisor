// This is the TableDatasource from
// this should go in the package datasources dir
// $ZENHOME/Products/ZenWidgets/skins/zenui/javascript/portlet.js
//
var UpdateTableDatasource = Class.create();

UpdateTableDatasource.prototype = {
    __class__ : "YAHOO.zenoss.portlet.UpdateTableDatasource",
    __init__: function(settings) {
        this.url = settings.url;
        this.queryArguments = 'queryArguments' in settings?
            settings.queryArguments:{};
        this.postContent = 'postContent' in settings?
            settings.postContent:'';
        this.method = 'method' in settings? settings.method:'POST';
        this.useRandomParameter = 'useRandomParameter' in settings?
            settings.useRandomParameter: true;
    },
    get: function(callback) {
        queryarguments = this.queryArguments;

        if ('ms' in queryarguments) delete queryarguments['ms'];
        if (this.useRandomParameter) {
            if ('_dc' in queryarguments) { delete queryarguments['_dc']; }
        } else {
            queryarguments['_dc'] = String(new Date().getTime());
        }
        /*
          doXHR on IE will add post content to queryargs which get passed
          as keyword parameters to backend. We need to get rid of _dc stuff
          altogether and use response headers. For now, we detect if we have
          any query args other that dc and if we are using POST. If so, don't
          add queryargs string to doXHR call. Server side user @nocache
          decorator.
        */
        var d;
        var has_args_other_than_dc = false;
        for (key in queryarguments) {
            if (key != '_dc') {
                has_args_other_than_dc = true;
                break;
            }
        }

        d = doXHR(this.url, {
            method: this.method,
            queryString: queryarguments,
            sendContent: serializeJSON(this.postContent)
        });

        d.addCallback(bind(function(r) {
            YAHOO.zenoss.globalPortletContainer.goodConnection();
            this.parseResponse(r, callback);
        }, this));

        d.addErrback(function(){
            YAHOO.zenoss.globalPortletContainer.brokenConnection();
        });
    },

    updateTable: function (response) {
        var worker;
        var worker_hash = this.worker_hash || {};
        var worker_name;
        var rows = response.data;
        var row_len = rows.length;

        while (row_len--) {
            worker = rows[row_len];

            worker_name = worker.Device + '_' + worker.Worker;

            worker_hash[worker_name] = worker;
        }
        this.worker_hash = worker_hash;
        this.columns = response.columns;

        return this.buildTable(worker_hash);
    },

    buildTable: function (worker_hash) {
        var worker, table_head, rows, row;

        table_head = '<thead><tr><th>' + this.columns.join('</th><th>') + '</th></tr></thead>';
        rows = '';
        for (worker_name in worker_hash) {
            worker = worker_hash[worker_name];

            row = '<tr><td>' + worker.Device + '</td><td>' + worker.Worker + '</td><td>'
                + worker.Status + '</td><td>' + worker['Last Updated'] + '</td></tr>';

            rows += row;
        }
        html = '<table>' + table_head + '<tbody>' + rows + '</tbody></table>';

        return html;
    },

    parseResponse: function(response, callback) {
        response = evalJSONRequest(response);
        // Should use YAHOO.widget.DataTable and call YZP.Portlet.filltable to render
        // but couldn't monkeypatch portlet superclass

        var first_call = this.queryArguments['lastupdate'] === undefined;
        var html;
        html = this.updateTable(response);

        // Store lastupdate as a query arg so we pull diffs
        this.queryArguments.lastupdate = response.lastupdate;

        callback({responseText: html });
    },

    __json__: function() {
        queryarguments = this.queryArguments;
        if ('ms' in queryarguments) delete queryarguments['ms'];
        if (this.useRandomParameter && ('_dc' in queryarguments)) {
            delete queryarguments['_dc'];
        } else {
            queryarguments['_dc'] = String(new Date().getTime());
        }
        return {url:this.url, queryArguments:queryarguments,
                postContent: this.postContent, method:this.method,
                __class__:this.__class__}
    }
}
YAHOO.zenoss.portlet.UpdateTableDatasource = UpdateTableDatasource;

var SupervisorStatusPortlet = YAHOO.zenoss.Subclass.create(
    YAHOO.zenoss.portlet.Portlet);

SupervisorStatusPortlet.prototype = {

    // Define the class name for serialization
    __class__:"YAHOO.zenoss.portlet.SupervisorStatusPortlet",

    // __init__ is run on instantiation (feature of Class object)
    __init__: function(args) {

        // args comprises the attributes of this portlet, restored
        // from serialization. Take them if they're defined,
        // otherwise provide sensible defaults.
        args = args || {};
        id = 'id' in args? args.id : getUID('SupervisorStatus');
        title = 'title' in args? args.title: "Workers";
        bodyHeight = 'bodyHeight' in args? args.bodyHeight:400;

        // You don't need a refresh time for this portlet. In case
        // someone wants one, it's available, but default is 3
        refreshTime = 'refreshTime' in args? args.refreshTime: 3;

        // The datasource has already been restored from
        // serialization, but if not make a new one.
        datasource = 'datasource' in args? args.datasource :
            new YAHOO.zenoss.portlet.UpdateTableDatasource({

                // Query string will never be that long, so GET
                // is appropriate here
                method:'GET',

                // Here's where you call the back end method
                url:'/zport/getJSONSupervisorWorkerStatus',

                // Set up the path argument
                queryArguments: {}
            });

        // Call Portlet's __init__ method with your new args
        this.superclass.__init__({
            id: id,
            title: title,
            datasource: datasource,
            refreshTime: refreshTime,
            bodyHeight: bodyHeight
        });

        // Create the settings pane for the portlet
        this.buildSettingsPane();
    },

    // buildSettingsPane creates the DOM elements that populate the
    // settings pane.
    buildSettingsPane: function() {
    },

}
YAHOO.zenoss.portlet.SupervisorStatusPortlet = SupervisorStatusPortlet;
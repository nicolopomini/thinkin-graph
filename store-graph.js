function create_UUID() {
	// general purpose function to generate an UUID
    let dt = new Date().getTime();
    let uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        let r = (dt + Math.random()*16)%16 | 0;
        dt = Math.floor(dt/16);
        return (c=='x' ? r :(r&0x3|0x8)).toString(16);
    });
    return uuid;
}

class Zone {
	// class representing a zone of RetailerIn
    /*
    * geometry: a MapTalks geometry object
    * zoneId: ID of the zone
    * zoneType: type of the zone (either division, department or aisle)
    */
    constructor(geometry, zoneId, zoneType) {
        this.geometry = geometry;
        this.zoneId = zoneId;
        this.zoneType = zoneType;
    }
}

class Node{
	// class representing a single node drawn on the map
    /*
    * geometry: a maptalks Geometry instance
    * uuid: an UUID
    * custom_id: (optional) a custom identifier
    * type: (optional) a (list of) string describing the type of the node (e.g. Aisle)
    * name: (optional) the name of the node
    * alreadySplitted: (optional) boolean flag that indicates whether the node is born by splitting a larger node
    */
    constructor(geometry, uuid, custom_id, type, name, zones, alreadySplitted = false) {
        this.geometry = geometry;
        this.uuid = uuid;
        this.custom_id = custom_id;
        this.name = name;
        this.type = type;
        this.zones = zones;
        this.alreadySplitted = alreadySplitted;
    }

    getWktRepresentation(multiplicator) {
    	// mutliplicator is a multiplication factor to avoid problems with geographical libraries
        let coords = this.geometry.toGeoJSON().geometry.coordinates[0];
        let wkt = "POLYGON((";
        coords.forEach((c) => {
            let x = c[0];
            let y = c[1];
            x *= multiplicator;
            y *= multiplicator;
            wkt += Math.round(x) + " " + Math.round(y) + ",";
        });
        wkt = wkt.substring(0, wkt.length - 1);
        wkt += "))";
        return wkt;
    }

    static createFromGeometry(geometry) {
        return new Node(geometry, create_UUID(), null, null, null, []);
    }

    to_repr(multiplicator) {
    	// mutliplicator is a multiplication factor to avoid problems with geographical libraries
        return {
            "wkt": this.getWktRepresentation(multiplicator),
            "uuid": this.uuid,
            "id": this.custom_id,
            "name": this.name,
            "type": this.type,
            "zones": this.zones,
            "already_splitted": this.alreadySplitted
        };
    }

    static fromRepr(raw) {
        let geom = new maptalks.Polygon(StoreLayoutMap.wktToGeoJson(raw.wkt, multiplicator),
            {
                id: raw.uuid,
                symbol: {
                  'lineColor' : 'black',
                  'lineWidth' : 1,
                  'polygonFill' : 'red',
                  'polygonOpacity' : 0.6
                }
            }
        );
        return new Node(geom, raw.uuid, raw.id, raw.type, raw.name, raw.zones, raw.already_splitted);
    }

    setInfoBox() {
        let customId = this.custom_id ? "Current value: " + this.custom_id : "Enter a custom ID";
        let name = this.name ? "Current value: " + this.name : "Type a name for the node";
        let type = this.type ? "Current value: " + this.type : "Enter node type(s)";
    	let that = this;
    	this.geometry.setInfoWindow({
			'title'     : 'Node ',
    		'content'   : `<form>
              <input type="hidden" id="nodeuuid" value="` + this.uuid + `">
              <div class="form-group">` + this.uuid + `</div>
              <div class="form-group">
                <label for="customidinput">Custom ID</label>
                <input type="text" class="form-control" id="customidinput" aria-describedby="customidhelp">
                <small id="customidhelp" class="form-text text-muted">` + customId + `</small>
              </div>
              <div class="form-group">
                <label for="nameinput">Name</label>
                <input type="text" class="form-control" id="nameinput" aria-describedby="nameinputhelp">
                <small id="nameinputhelp" class="form-text text-muted">` + name + `</small>
              </div>
              <div class="form-group">
                <label for="typeinput">Type</label>
                <input type="text" class="form-control" id="typeinput" aria-describedby="typeinputhelp">
                <small id="typeinput" class="form-text text-muted">` + type + `</small>
              </div>
              <a type="button" class="btn btn-primary" onclick="editNode()">Submit</a>
            </form>`,
            'autoOpenOn' : 'click'
		});
		this.geometry.on('click', function() {
				that.geometry.openInfoWindow();
		});
    }

    editNode(customId, name, nodeType) {
        this.custom_id = customId;
        this.name = name;
        this.type = nodeType;
    }

    static editingFunction(node) {
    	// function used when n editing mode and the node is clicked
    	node.geometry.startEdit();
    }
}

class StoreLayoutMap {
	// class containing the store layout map
    /*
    * environmentData: EnvironmentInfo definitions with the following format
    *    {
    *        "id": string,
    *        "title": string,
    *        "xOrigOffsetMm": number,
    *        "yOrigOffsetMm": number,
    *        "widthMm": number,
    *        "heightMm": number,
    *        "plan": { "image": <base64 encoded image> }
    *    }
    * zoneData: zone list definition in the following format:
    *   {
    *       "zoneId": int,
    *       "wkt": string,
    *       "type": string
    *   }
    * multiplicator: int number to avoid visualization problem with millimetric data (suggested value: 1000)
    */
	constructor(environmentData, zoneData, multiplicator) {
		this.environmentData = environmentData;
		this.zoneData = zoneData;
		this.multiplicator = multiplicator;

		let minXmap = this.environmentData.xOrigOffsetMm / this.multiplicator;
        let minYmap = (this.environmentData.heightMm - this.environmentData.yOrigOffsetMm) /this.multiplicator;
        let maxXmap = (this.environmentData.xOrigOffsetMm + this.environmentData.widthMm) / this.multiplicator;
        let maxYmap = this.environmentData.yOrigOffsetMm / this.multiplicator;

        //statuses
        this.drawing = true;
        this.editing = false;

        this.shapes = [];	// sorted to allow the 'undo' operation
      	this.nodes = {};
      	this.edges = {};
      	this.zones = {};

      	this.map = new maptalks.Map('map', {
	        center: [minXmap +  (maxXmap - minXmap) / 2, minYmap + (maxYmap - minYmap) / 2],
	        zoom:  0,
	        spatialReference : {
	          projection : 'identity',
	          resolutions : [
	            0.32, 0.16, 0.08, 0.04, 0.02, 0.01, 0.005
	          ]
	        }
	      });

      	this.map.addLayer(
			new maptalks.ImageLayer('images', [
			  {
			    url: "data:image/png;base64," + this.environmentData.plan.image,
			    extent: [minXmap, minYmap, maxXmap, maxYmap],
			    opacity: 1
			  }
			], {
			  crossOrigin: "anonymous"
			})
		);

      	this.layer = new maptalks.VectorLayer('vector').addTo(this.map);

      	this.drawTool = new maptalks.DrawTool({
			mode: 'Point'
		}).addTo(this.map).disable();

		let that = this;	// to avoid scope problems

		this.drawTool.on('drawend', function (param) {
			let geom = param.geometry;
			geom.setSymbol({
			  'lineColor' : 'black',
			  'lineWidth' : 1,
			  'polygonFill' : 'red',
			  'polygonOpacity' : 0.6
			});
			let node = Node.createFromGeometry(geom);
			node.setInfoBox();
			geom.setId(node.uuid);
			that.nodes[node.uuid] = node;
			that.layer.addGeometry(geom);
			that.shapes.push(geom);
			});

		var items = ['Polygon', 'Rectangle'].map(function (value) {
	        return {
				item: value,
				click: function () {
					if (that.editing) {
						document.getElementById("editSwitch").click();
					}
			    	that.drawTool.setMode(value).enable();
			    	}
				};
			});

      	this.toolbar = new maptalks.control.Toolbar({
	        items: [
	          {
	            item: 'Shape',
	            children: items
	          },
	          {
	            item: 'Disable',
	            click: function () {
	              that.drawTool.disable();
	            }
	          },
	          {
	            item: 'Clear',
	            click: function () {
	              that.layer.clear();
	              that.shapes = [];
	              that.nodes = {};
	              that.edges = {};
	            }
	          }
	          // ,
	          // {
	          //   item: 'End edit',
	          //   click: function () {
	          //       for (let i in that.nodes)
	          //           nodes[i].geometry.endEdit();
	          //   }
	          // }
	        ]
      	}).addTo(this.map);

      	this.divisionLayer = new maptalks.VectorLayer('divisions', {visible: false}).addTo(this.map);
        this.departmetLayer = new maptalks.VectorLayer('departments', {visible: false}).addTo(this.map);
        this.aisleLayer = new maptalks.VectorLayer('aisles', {visible: false}).addTo(this.map);
      	this.loadZones();
	}

	startDrawing() {
		this.drawing = true;
	}

	endDrawing() {
		this.drawing = false;
		this.drawTool.disable();
	}

	startEdit() {
		let that = this;
		this.editing = true;
		for (let i in this.nodes) {
			this.nodes[i].geometry.on('click', Node.editingFunction(this.nodes[i]));
		}
	}

	endEdit() {
		this.editing = false;
		for (let i in this.nodes) {
			this.nodes[i].geometry.off('click', Node.editingFunction(this.nodes[i]));
			this.nodes[i].geometry.endEdit();
			this.nodes[i].setInfoBox();
		}
	}

	undoLastDrawing() {
		if (this.shapes.length > 0) {
			let removed = this.shapes.splice(this.shapes.length - 1, 1);
            this.layer.removeGeometry(removed);
            delete this.nodes[removed[0].getId()];
		}
	}

	loadZones() {
        // prepare the layers to visualize zones in the map
        for (let i in this.zoneData) {
            let zoneObj = this.zoneData[i];
            let zoneId = zoneObj.zoneId;
            let wkt = zoneObj.wkt;
            let color = null;
            let type = zoneObj.type;
            if (type == "Division")
                color = "blue";
            else if (type == "Department")
                color = "green";
            else if (type == "Aisle")
                color = "orange";
            else
                color = "pink";
            let geom = new maptalks.Polygon(
                StoreLayoutMap.wktToGeoJson(wkt, this.multiplicator),
                {
                    id: zoneId,
                    symbol: {
                      'lineColor' : 'black',
                      'lineWidth' : 1,
                      'polygonFill' : color,
                      'polygonOpacity' : 0.4
                    }
                }
            );
            if (type == "Division")
                this.divisionLayer.addGeometry(geom);
            else if (type == "Department")
                this.departmetLayer.addGeometry(geom);
            else if (type == "Aisle")
                this.aisleLayer.addGeometry(geom);
            this.zones[zoneId] = new Zone(geom, zoneId, type);
        }
    }

    static wktToGeoJson(wkt, multiplicator) {
        // https://stackoverflow.com/questions/58537873/parse-wkt-strings-to-get-array-of-points
        // wkt is a string like POLYGON ((162353.9901277053 564298.9605047705,162352.3101277038 564286.9905047683....))
        var geojson_pgons = Terraformer.WKT.parse(wkt);

        // get coordinates list of the first object
        var poly0xys = geojson_pgons.coordinates[0];

        // collect what we need
        var result = [];
        for (let i=0; i<poly0xys.length; i++) {

            result.push(  [poly0xys[i][0] / multiplicator, poly0xys[i][1] / multiplicator] );
        }
        return result;
    }

    showZones(showDivisions, showDepartments, showAisles) {
        // show/hide zone layers
        if (showDivisions)
            this.divisionLayer.show();
        else
            this.divisionLayer.hide();

        if (showDepartments)
            this.departmetLayer.show();
        else
            this.departmetLayer.hide();

        if (showAisles)
            this.aisleLayer.show();
        else
            this.aisleLayer.hide();
    }

    static resolveIntersections(shape1, shape2) {
        /*
        Resolve the intersection between 2 MapTalks polygons, choosing the solution that generates the lower number of points
        The two shapes in input are modified with the new points
        */
        let tPolygon = turf.polygon(shape1.toGeoJSON().geometry.coordinates);
        let tOther = turf.polygon(shape2.toGeoJSON().geometry.coordinates);
        let difference1 = turf.difference(tPolygon, tOther);
        let points1 = difference1.geometry.coordinates[0].length + tOther.geometry.coordinates[0].length;
        let difference2 = turf.difference(tOther, tPolygon);
        let points2 = difference2.geometry.coordinates[0].length + tPolygon.geometry.coordinates[0].length;
        if (points1 < points2) {
            shape1.setCoordinates(difference1.geometry.coordinates);
        }
        else {
            shape2.setCoordinates(difference2.geometry.coordinates);
        }
    }

    findIntersection(nodeId) {
        // find intersections between polygon with the specified ID and all the others.
        let polygon = this.nodes[nodeId].geometry;
        for (let node in this.nodes) {
            let tPolygon = turf.polygon(polygon.toGeoJSON().geometry.coordinates);
            let tOther = turf.polygon(this.nodes[node].geometry.toGeoJSON().geometry.coordinates);
            if (nodeId != node && turf.booleanOverlap(tPolygon, tOther)) {
                // add link between the two nodes
                if (nodeId in this.edges)
                    this.edges[nodeId].push(node);
                else
                    this.edges[nodeId] = [node];
                if (node in this.edges)
                    this.edges[node].push(nodeId);
                else
                    this.edges[node] = [nodeId];
                // resolve intersection
                StoreLayoutMap.resolveIntersections(polygon, this.nodes[node].geometry);
            }
        }
    }

    findEdges() {
        // add edge between two bordering nodes
        this.edges = {}
        for (let nodeA in this.nodes) {
            this.edges[nodeA] = [];
            for (let nodeB in this.nodes) {
                if (nodeA != nodeB) {
                    let tPolygon = turf.polygon(this.nodes[nodeA].geometry.toGeoJSON().geometry.coordinates);
                    let tOther = turf.polygon(this.nodes[nodeB].geometry.toGeoJSON().geometry.coordinates);
                    if (turf.booleanOverlap(tPolygon, tOther)) {
                        this.edges[nodeA].push(nodeB);
                    }
                }
            }
        }
    }

    addZones() {
        // add zone IDs to each node
        for (let nodeId in this.nodes) {
            for (let zoneId in this.zones) {
                let node = this.nodes[nodeId];
                let z = this.zones[zoneId];
                let tPolygon = turf.polygon(node.geometry.toGeoJSON().geometry.coordinates);
                let tOther = turf.polygon(z.geometry.toGeoJSON().geometry.coordinates);
                if (!turf.booleanDisjoint(tPolygon, tOther))
                    node.zones.push(zoneId);
            }
        }
    }

    splitNode(node, length) {
        // divide too long nodes
        this.layer.removeGeometry(node.geometry);
        const newNodes = [];
        let coords = node.geometry.toGeoJSON();
        let [minX, minY, maxX, maxY] = turf.bbox(coords);
        const vertical = (maxX - minX) < (maxY - minY);
        const distance = vertical ? maxY - minY : maxX - minX;
        const splits = Math.ceil(distance / length);
        let original = turf.polygon(node.geometry.toGeoJSON().geometry.coordinates);
        let previousRemovingRectangle = turf.bboxPolygon(turf.bbox(coords));

        let lowerLeft = [minX, minY];
        let lowerRight = [maxX, minY];
        let upperLeft = [minX, maxY];
        let upperRight = [maxX, maxY];

        let p1 = null;
        let p2 = null;
        let p3 = null;
        let p4 = null;
        for (let i = 1; i < splits; i++) {
          if (vertical) {
              p1 = [lowerLeft[0], lowerLeft[1] + i * length];
              p2 = [lowerRight[0], lowerRight[1] + i * length];
              p3 = upperRight;
              p4 = upperLeft;
          }
          else {
              p1 = [lowerLeft[0] + i * length, lowerLeft[1]];
              p2 = [upperLeft[0] + i * length, upperLeft[1]];
              p3 = upperRight;
              p4 = lowerRight;
          }
          // create rect and diff
          let removingRectangle = turf.polygon([[p1, p2, p3, p4, p1]]);
          let rectangleSlice = turf.difference(previousRemovingRectangle, removingRectangle);
          let difference = turf.difference(original, removingRectangle);
          const geom = new maptalks.Polygon(difference.geometry.coordinates);
          geom.setSymbol({
              'lineColor' : 'black',
              'lineWidth' : 1,
              'polygonFill' : 'red',
              'polygonOpacity' : 0.6
          });
          this.layer.addGeometry(geom);
          original = turf.difference(original, rectangleSlice);
          previousRemovingRectangle = removingRectangle;
          const newNode = new Node(geom, create_UUID(), node.custom_id, node.type, node.name, [], true);
          newNodes.push(newNode);
        }
        // add missing part (if any)
        if (original) {
          const geom = new maptalks.Polygon(original.geometry.coordinates);
          geom.setSymbol({
              'lineColor' : 'black',
              'lineWidth' : 1,
              'polygonFill' : 'red',
              'polygonOpacity' : 0.6
          });
          this.layer.addGeometry(geom);
          const newNode = new Node(geom, create_UUID(), node.custom_id, node.type, node.name, [], true);
          newNodes.push(newNode);
        }
        return newNodes;
    }

    createGraph() {
        this.drawTool.disable();
    	for (let node in this.nodes)
            this.findIntersection(node);
        const newNodes = [];
        for (let node in this.nodes) {
            if (!this.nodes[node].alreadySplitted) {
                newNodes.push.apply(newNodes, this.splitNode(this.nodes[node], 5));
                delete this.nodes[node];
            }
        }
        let that = this;
        newNodes.forEach(node => {
            node.setInfoBox();
            that.nodes[node.uuid] = node;
        });
        this.findEdges();
        this.addZones();
    }

    importRawData(content) {
        // content is a JSON
        for (let i in content["shapes"]) {
            let n = Node.fromRepr(content["shapes"][i]);
            n.setInfoBox();
            this.layer.addGeometry(n.geometry);
            this.nodes[n.uuid] = n;
        }
        this.edges = content["edges"];
    }

    exportData() {
        const exportNodes = [];
        for (let i in this.nodes) {
            exportNodes.push(this.nodes[i].to_repr(this.multiplicator));
        }
        return {
            "shapes": exportNodes,
            "edges": this.edges
        }
    }

    editNode(nodeUuid, customId, name, nodeType) {
        this.nodes[nodeUuid].editNode(customId, name, nodeType);
        this.nodes[nodeUuid].setInfoBox();
    }
  }


function showImport() {
    var importDiv = document.getElementById("importDataDiv");
    if (!importDiv.style.display || importDiv.style.display == 'none')
        importDiv.style.display = 'block';
    else
        importDiv.style.display = 'none';
}

function showExport() {
    var exportDiv = document.getElementById("exportDataDiv");
    if (!exportDiv.style.display || exportDiv.style.display == 'none')
        exportDiv.style.display = 'block';
    else
        exportDiv.style.display = 'none';
    document.getElementById("exportDataCopy").innerHTML = JSON.stringify(map.exportData(), null, 2);
}

var map = null;
var multiplicator = 1000;
function init() {
	map = new StoreLayoutMap(data.environmentsInfo[0], zones, multiplicator);
}

function editSwitchClick() {
	if (document.getElementById("editSwitch").checked) {
		map.endDrawing();
		map.startEdit();
	} else {
		map.endEdit();
	}
}

function showZonesClick() {
    var zoneControlDiv = document.getElementById("controlZones");
	if (document.getElementById("showZonesSwitch").checked) {
        zoneControlDiv.style.display = 'block';
    } else {
        zoneControlDiv.style.display = 'none';
    }
}

function showZones() {
    var showDivisions = document.getElementById("showDivisions").checked;
    var showDeparments = document.getElementById("showDepartments").checked;
    var showAisles = document.getElementById("showAisles").checked;
    map.showZones(showDivisions, showDeparments, showAisles);
}

function undo() {
	map.undoLastDrawing();
}

function createGraph() {
  document.getElementById("editSwitch").disabled = true;
  document.getElementById("undoButton").disabled = true;
	map.createGraph();
}

function importRawData() {
    var content = JSON.parse(document.getElementById("importData").value);
    map.importRawData(content);
}

function editNode() {
    var customId = document.getElementById("customidinput").value;
    var name = document.getElementById("nameinput").value;
    var nodeType = document.getElementById("typeinput").value;
    var nodeId = document.getElementById("nodeuuid").value;
    map.editNode(nodeId, customId, name, nodeType);
}

function copyToClipboard() {
    var copyText = document.getElementById("exportDataCopy");
    copyText.select();
    copyText.setSelectionRange(0, 99999);
    document.execCommand("copy");
}

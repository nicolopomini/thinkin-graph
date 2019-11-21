class OpenLayersPlanView {
    /*
     * - container: id of the HTML container for the map
     * - environments: list of EnvironmentInfo definitions with the following format
     *    {
     *        "id": string,
     *        "title": string,
     *        "xOrigOffsetMm": number,
     *        "yOrigOffsetMm": number,
     *        "widthMm": number,
     *        "heightMm": number,
     *        "plan": { "image": <base64 encoded image> }
     *    }
     *
     * - zones: list of zone definitions with the following format
     *  {
     *    "id": { "deploymentId": string, "zoneId": string },
     *    "environment": string,
     *    "shape": wkt-string,
     *  }
     */
    constructor(mapContainer, environment, modeDisplay, undoButton) {
        this.mapContainer = mapContainer;
        this.envStore = {};
        this.modeDisplay = modeDisplay;
        this.modality = null;
        this.actions = [];
        this.undoButton = undoButton;
        this.shapes = {};
        this.map = null;
        this.projection = null;
        this.drawSource = null;
        this.shapeSource = null;
        this.shapeLayer = null;
        this.initializeEnvironment(environment);
        this.modeDraw();
    }

    initializeEnvironment(environment) {
        const envContainer = document.getElementById(this.mapContainer);
        const that = this;
        console.log("Initializing environmentId=[" + environment.id + "] title=[" + environment.title + "]");
        const divId = "map-" + environment.id;

        envContainer.innerHTML += "<div id='" + divId + "'></div>";
        //that.envStore[environmentInfo.id] = that.initializeEnvironmentMap(divId, environmentInfo);
        var extent = [
            environment.xOrigOffsetMm,
            environment.heightMm - environment.yOrigOffsetMm,
            environment.xOrigOffsetMm + environment.widthMm,
            environment.yOrigOffsetMm
        ];

        var projection = new ol.proj.Projection({
            units: 'mm',
            extent: extent
        });


        var envSource = new ol.source.ImageStatic({
            projection: projection,
            imageExtent: extent,
            imageLoadFunction: function (image) {
                image.getImage().src = "data:image/png;base64," + environment.plan.image;
            }
        });


        var envLayer = new ol.layer.Image({
            source: envSource
        });

        // layer usato per disegnare col mouse
        let drawSource = new ol.source.Vector({});
        let drawLayer = new ol.layer.Vector({
            source: drawSource,
            projection: projection
        });

        // layer dove salvo i rettangoli
        let shapeSource = new ol.source.Vector({});
        let shapeLayer = new ol.layer.Vector({
            source: shapeSource,
            projection: projection
        });

        var map = new ol.Map({
            layers: [envLayer, drawLayer, shapeLayer],
            target: divId,
            view: new ol.View({
                projection: projection,
                center: ol.extent.getCenter(extent),
                zoom: 2,
                maxZoom: 8
            })
        });
        this.map = map;
        this.projection = projection;
        this.drawSource = drawSource;
        this.shapeSource = shapeSource;
        this.shapeLayer = shapeLayer;
    }

    initializeEnvironmentMap(divId, environmentInfo) {
        var extent = [
            environmentInfo.xOrigOffsetMm,
            environmentInfo.heightMm - environmentInfo.yOrigOffsetMm,
            environmentInfo.xOrigOffsetMm + environmentInfo.widthMm,
            environmentInfo.yOrigOffsetMm
        ];

        var projection = new ol.proj.Projection({
            units: 'mm',
            extent: extent
        });


        var envSource = new ol.source.ImageStatic({
            projection: projection,
            imageExtent: extent,
            imageLoadFunction: function (image) {
                image.getImage().src = "data:image/png;base64," + environmentInfo.plan.image;
            }
        });


        var envLayer = new ol.layer.Image({
            source: envSource
        });

        // layer usato per disegnare col mouse
        let drawSource = new ol.source.Vector({});
        let drawLayer = new ol.layer.Vector({
            source: drawSource,
            projection: projection
        });

        // layer dove salvo i rettangoli
        let shapeSource = new ol.source.Vector({});
        let shapeLayer = new ol.layer.Vector({
            source: shapeSource,
            projection: projection
        });

        var map = new ol.Map({
            layers: [envLayer, drawLayer, shapeLayer],
            target: divId,
            view: new ol.View({
                projection: projection,
                center: ol.extent.getCenter(extent),
                zoom: 2,
                maxZoom: 8
            })
        });

        return {
            "map": map,
            "projection": projection,
            "drawSource": drawSource,
            "shapeSource": shapeSource,
            "shapeLayer": shapeLayer
        };
    }

    modeDraw() {
        const that = this;
        that.modality = "draw";
        // remove drag movements of the map
        that.map.getInteractions().clear();
        // display message
        that.modeDisplay.innerHTML = "Draw mode: draw with your mouse the zones of the supermarket. Use ALT+click to move the map, scroll to zoom";
        that.map.addInteraction(new ol.interaction.DragPan({
            condition: ol.events.condition.altKeyOnly
        }));
        that.map.addInteraction(new ol.interaction.MouseWheelZoom());
        // add drawing function
        let draw = new ol.interaction.Draw({
            source: that.drawSource,
            type: 'MultiLineString',
            condition: ol.events.condition.singleClick,
            freehandCondition: ol.events.condition.noModifierKeys
        });
        that.drawSource.on('addfeature', function(evt) {
            that.undoButton.disabled = false;
            let feature = evt.feature;
            let coords = feature.getGeometry().getCoordinates();
            // crea la shape
            let shape = new Rectangle(coords[0]);
            try {
                that.drawSource.removeFeature(feature); 
                that.shapeSource.addFeature(shape.feature);
                that.actions.push(new ActionDraw(shape));
                that.undoButton.innerHTML = "Undo draw";
                that.shapes[shape.uuid] = shape;
                that.addNodeControl(shape);
            } catch(e) {}
        });
        that.map.addInteraction(draw);
    }

    addNodeControl(rectangle) {
        let table = $("#tableNodes").DataTable();
        let id = rectangle.id;
        let name = rectangle.name;
        let type = rectangle.type;
        let content = [];
        if (id == null)
            content.push("<input type='text' class='form-control' id='" + rectangle.uuid + "nodeId' placeholder='12345' oninput='inputSelect(\"" + rectangle.uuid + "\")'>");
        else
            content.push(id);
        if (name == null)
            content.push("<input type='text' class='form-control' id='" + rectangle.uuid + "nodeName' placeholder='Node name' oninput='inputSelect(\"" + rectangle.uuid + "\")'>");
        else
            content.push(name);
        if (type == null)
            content.push("<select class=\"form-control\" size=\"1\" id='" + rectangle.uuid + "nodeType'><option value=''>-</option><option>AISLE</option><option>ACTION_ALLEY</option><option>CORRIDOR</option></select>");
        else
            content.push(type);
        content.push("<button type='submit' class='btn btn-default' onclick='applyNames(\"" + rectangle.uuid + "\")'>Apply</button><button type='submit' class='btn btn-default' onclick='editShape(\"" + rectangle.uuid + "\")'>Edit</button><button type='submit' class='btn btn-default' onclick='deleteShape(\"" + rectangle.uuid + "\")'>Delete</button>");
        let api = table.row.add(content);
        api.node().id = rectangle.uuid;
        api.draw(false);
    }

    deleteShape(id) {
        let shape = this.shapes[id];
        let table = $("#tableNodes").DataTable();
        table.row("#" + id).remove();
        table.draw();
        this.shapeSource.removeFeature(shape.feature);
        shape.feature.setGeometry(new ol.geom.Point([]));
        delete this.shapes[id];
    }

    undo() {
        const that = this;
        console.log("Undoing last operation");
        that.map.getInteractions().forEach(function(interaction) {
            if (interaction instanceof ol.interaction.Draw) {
                that.map.removeInteraction(interaction);
            }
        }, this);

        let item = that.actions.pop();
        if (item instanceof ActionDraw) {
            that.deleteShape(item.shape.uuid);
        } 
        if (that.actions.length == 0) {
            that.undoButton.disabled = true;
            that.undoButton.innerHTML = "Undo";
        } else {
            let netxItem = that.actions[that.actions.length - 1];
            if (netxItem instanceof ActionDraw)
                that.undoButton.innerHTML = "Undo draw";
            else {
                that.undoButton.disabled = true;
                that.undoButton.innerHTML = "Undo";
            }
        }

        if (that.mode == "display")
            that.modeConnect();
        else
            that.modeDraw();
    }

    modeEdit() {
        const that = this;
        that.modality = "display";
        that.modeDisplay.innerHTML = "Edit mode: click on the edges of shapes to change their sizes. Use click to move the map, scroll to zoom";
        let map = that.map;
        map.getInteractions().clear();
        map.addInteraction(new ol.interaction.DragPan());
        map.addInteraction(new ol.interaction.MouseWheelZoom());
        const modify = new ol.interaction.Modify({
            source: that.shapeSource,
            insertVertexCondition: (x) => {return false;}
        });
        map.addInteraction(modify);
        modify.on('modifyend', (evt) => {
            let toModify = [];
            evt.features.getArray().forEach((feature) => {
                let id = feature.id;
                if (!id)
                    id = feature.getId();
                let data = feature.getGeometry().getCoordinates()[0];
                toModify.push({
                    shapeId: id,
                    points: data,
                    feature: feature
                });
            });
            toModify.forEach((data) => {
                let shapeId = data.shapeId;
                let newPoints = data.points;
                if (newPoints.length != 5)
                    throw new Error("Wrong number of points defining the modified shape. Expected 5, got " + newPoints.length);
                newPoints.pop();
                let shape = that.shapes[shapeId];
                that.shapeSource.removeFeature(data.feature);
                shape.reshape(newPoints);
                that.shapeSource.addFeature(shape.feature);
            });
        });

    }

    setNodeDetails(uuid, nodeId, nodeName, nodeType) {
        let node = this.shapes[uuid];
        let table = $("#tableNodes").DataTable();
        if (nodeId != null) {
            node.id = nodeId.value == '' ? null : nodeId.value;
            if (node.id != null) {
                var td1 = nodeId.closest('td');
                table.cell(td1).data(node.id);
            }
        }
        if (nodeName != null) {
            node.name = nodeName.value == '' ? null : nodeName.value;
                if (node.name != null) {
                var td2 = nodeName.closest('td');
                table.cell(td2).data(node.name);
            }
        }
        if (nodeType != null)  {
            node.type = nodeType.value == '' ? null : nodeType.value;
                if (node.type != null) {
                var td3 = nodeType.closest('td');
                table.cell(td3).data(node.type);
            }
        }
        node.restoreStyle();
    }

    selectShape(shapeId) {
        for (let key in this.shapes) {
            if (this.shapes[key].uuid == shapeId)
                this.shapes[key].selectedStyle();
            else
                this.shapes[key].restoreStyle();
        }
    }

    exportRaw() {
        let content = [];
        for (let key in this.shapes) {
            content.push(this.shapes[key].toRepr());
        }
        return content;
    }
    importRaw(content) {
        let shapes = [];
        if (!Array.isArray(content)) {;
            shapes.push(content);
        } else {
            shapes = content;
        }
        shapes.forEach((rect) => {
            let rectObj = Rectangle.fromRepr(rect);
            this.shapes[rectObj.uuid] = rectObj;
            this.shapeSource.addFeature(rectObj.feature);
            this.addNodeControl(rectObj);
        });
    }
}

class Rectangle{
    /*
    - array of points [
        [x, y]
    ]
    */
    constructor(points) {
        this.uuid = Rectangle.create_UUID();
        this.lowerLeft = new Point(this.getMinX(points), this.getMinY(points));
        this.lowerRight = new Point(this.getMaxX(points), this.getMinY(points));
        this.upperLeft = new Point(this.getMinX(points), this.getMaxY(points));
        this.upperRight = new Point(this.getMaxX(points), this.getMaxY(points));
        this.initFeature();
        this.id = null;
        this.name = null;
        this.type = null;
    }

    initFeature() {
        let edges = [this.lowerLeft.getArray(), this.lowerRight.getArray(), this.upperRight.getArray(), this.upperLeft.getArray(), this.lowerLeft.getArray()];
        let polygon = new ol.geom.Polygon([edges]);
        this.feature = new ol.Feature(polygon);
        this.feature.setId(this.uuid);
        this.feature.setStyle(
            new ol.style.Style({
                fill: new ol.style.Fill({
                    color: [255, 0, 0, 0.5] // red with transparency
                }),
                stroke: new ol.style.Stroke({
                            color: "black",
                            width: 1,
                        })
            })
        );
    }

    getMinX(points) {
        let min = Infinity;
        for (let i in points)
            min = points[i][0] < min ? points[i][0] : min;
        return min;
    }

    getMaxX(points) {
        let max = -Infinity;
        for (let i in points)
            max = points[i][0] > max ? points[i][0] : max;
        return max;
    }

    getMinY(points) {
        let min = Infinity;
        for (let i in points)
            min = points[i][1] < min ? points[i][1] : min;
        return min;
    }

    getMaxY(points) {
        let max = -Infinity;
        for (let i in points)
            max = points[i][1] > max ? points[i][1] : max;
        return max;
    }

    static create_UUID(){
        let dt = new Date().getTime();
        let uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            let r = (dt + Math.random()*16)%16 | 0;
            dt = Math.floor(dt/16);
            return (c=='x' ? r :(r&0x3|0x8)).toString(16);
        });
        return uuid;
    }

    getCenter() {
        let x = this.lowerLeft.getX() + (this.lowerRight.getX() - this.lowerLeft.getX()) / 2.0;
        let y = this.lowerLeft.getY() + (this.upperLeft.getY() - this.lowerLeft.getY()) / 2.0;
        return new Point(x, y);
    }

    selectedStyle() {
        this.feature.setStyle(
            new ol.style.Style({
                fill: new ol.style.Fill({color: [255, 178, 0, 0.5]}),
                stroke: new ol.style.Stroke({
                            color: "black",
                            width: 1
                        })
            })
        );
    } 

    restoreStyle() {
        this.feature.setStyle(
            new ol.style.Style({
                fill: new ol.style.Fill({color: [255, 0, 0, 0.5]}),
                stroke: new ol.style.Stroke({
                            color: "black",
                            width: 1,
                            opacity: 0.2
                        })
            })
        );
    }

    pointListindex(pointList, point) {
        let index = -1;
        for (let i = 0; i < pointList.length; i++)
            if (point.equals(pointList[i]))
                index = i;
        return index;
    }

    reshape(newPoints) {
        if (newPoints.length != 4)
            throw new Error("New points must be 4.");
        let different = null;
        let edgeToChange = null;
        let allPoints = [this.lowerLeft, this.lowerRight, this.upperLeft, this.upperRight];
        newPoints.forEach((point) => {
            let pointObj = new Point(point[0], point[1]);
            let index = this.pointListindex(allPoints, pointObj);
            if (index < 0) {
                different = pointObj;
            }
            else {
                allPoints.splice(index, 1);
            }
        });
        if (different != null) {
            edgeToChange = allPoints[0];
            if (edgeToChange == this.lowerLeft) {
                this.lowerLeft = new Point(different.x, different.y);
                this.lowerRight.y = different.y;
                this.upperLeft.x = different.x;
            } else if (edgeToChange == this.lowerRight) {
                this.lowerRight = new Point(different.x, different.y);
                this.lowerLeft.y = different.y;
                this.upperRight.x = different.x;
            } else if (edgeToChange == this.upperLeft) {
                this.upperLeft = new Point(different.x, different.y);
                this.lowerLeft.x = different.x;
                this.upperRight.y = different.y;
            } else {
                this.upperRight = new Point(different.x, different.y);
                this.upperLeft.y = different.y;
                this.lowerRight.x = different.x;
            }
            this.initFeature();
        }
    }

    toRepr() {
        let format = new ol.format.WKT();
        let wkt = format.writeGeometry(this.feature.getGeometry(), {decimals: 0});
        return {
            "uuid": this.uuid,
            "wkt": wkt,
            "name": this.name,
            "id": this.id,
            "type": this.type
        }
    }

    static fromRepr(raw) {
        let format = new ol.format.WKT();
        let feature = format.readFeature(raw['wkt']).getGeometry().getCoordinates()[0];
        let rect = new Rectangle(feature);
        rect.uuid = raw['uuid'] ? raw['uuid'] : Rectangle.create_UUID();
        rect.id = raw['id'];
        rect.name = raw['name'];
        rect.type = raw['type'];
        // when importing data, use the original shape and not force a rectangle
        let polygon = new ol.geom.Polygon([feature]);
        rect.feature = new ol.Feature(polygon);
        rect.restoreStyle();
        rect.feature.id = rect.uuid;
        return rect;
    }
}

class Point{
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }
    getX() {
        return this.x;
    }
    getY() {
        return this.y;
    }
    getArray() {
        return [this.x, this.y];
    }
    equals(point) {
        return this.x == point.x && this.y == point.y;
    }
}

class ActionDraw{
    constructor(shape) {
        this.shape = shape;
    }
}
class ActionSelect{
    constructor(shape) {
        this.shape = shape;
    }
}
class ActionConnect{
    constructor(fig1, fig2, line) {
        this.fig1 = fig1;   // rectangle
        this.fig2 = fig2;   // rectangle
        this.line = line;   // feature
    }
}

var planView = null;
var drawButton = null;
var zoomSlider = null;
var modeDisplay = null;
var undoButton = null;
var editButton = null;

function init() {
    console.log("Initializing OpenLayerPlanView");
    drawButton = document.getElementById("drawButton");
    zoomSlider = document.getElementById("zoomSlider");
    modeDisplay = document.getElementById("modeDisplay");
    undoButton = document.getElementById("undoButton");
    editButton = document.getElementById("editButton");
    planView = new OpenLayersPlanView("maps", data.environmentsInfo[0], modeDisplay, undoButton);
}

var playTimer = null;
var tickMillis = 100;

function toggleVisible(){
    var options = {};
    $('#tablesConfig').toggle('drop');
}

function startDraw() {
    editButton.classList.remove("active");
    drawButton.classList.add("active");
    planView.modeDraw();
}
function undo() {
    planView.undo();
}
function startEdit() {
    drawButton.classList.remove("active");
    editButton.classList.add("active");
    planView.modeEdit();
}
function applyNames(id) {
    var nodeId = document.getElementById(id + "nodeId");
    var nodeName = document.getElementById(id + "nodeName");
    var nodeType = document.getElementById(id + "nodeType");
    planView.setNodeDetails(id, nodeId, nodeName, nodeType);
}
function editShape(id) {
    $('#' + id).find('td').each((i, td) => {
        switch(i) {
            case 0:
                if (!$(td).find('input').length) {
                    // in case is a td
                    let oldValue = td.innerHTML;
                    td.innerHTML = "<input type='text' class='form-control' id='" + id + "nodeId' value='" + oldValue + "' oninput='inputSelect(\"" + id + "\")'>";
                }
            break;
            case 1:
                if (!$(td).find('input').length) {
                    let oldValue = td.innerHTML;
                    td.innerHTML = "<input type='text' class='form-control' id='" + id + "nodeName' value='" + oldValue + "' oninput='inputSelect(\"" + id + "\")'>";
                }
            break;
            case 2:
                if (!$(td).find('select').length) {
                    td.innerHTML = "<select class=\"form-control\" size=\"1\" id='" + id + "nodeType'><option value=''>-</option><option>AISLE</option><option>ACTION_ALLEY</option><option>CORRIDOR</option></select>";
                }
            break;
        }
    });
}
function inputSelect(idShape) {
    planView.selectShape(idShape);
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
    var exportText = document.getElementById("exportData");
    exportText.innerHTML = JSON.stringify(planView.exportRaw(), null, 2);
}

function importRawData() {
    var content = JSON.parse(document.getElementById("importData").value);
    planView.importRaw(content);
}
function applyAll() {
    $('#tableNodes > tbody  > tr > td > button').each(function(_, btn) {
        if(btn.innerHTML === "Apply") {
            btn.click();
        }
    });
}
function editAll() {
    $('#tableNodes > tbody  > tr > td > button').each(function(_, btn) {
        if(btn.innerHTML === "Edit") {
            btn.click();
        }
    });
}
function deleteShape(id) {
    planView.deleteShape(id);
}
function deleteAll() {
    $('#tableNodes > tbody  > tr > td > button').each(function(_, btn) {
        if(btn.innerHTML === "Delete") {
            btn.click();
        }
    });
}
/*
Aggiungere:
- split sul lato lungo, con riferimento alla zona originale
*/
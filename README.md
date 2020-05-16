# Web tool for drawing a graph over the Store

## How to draw
Simply go with your mouse over the `Shape` button in the _blueish_ menu, and there select the shape you want to draw. After that, simply click on a point on the map, where you want to start drawing. Some shapes, like rectangles, are drawn with 2 clicks; some others, like a general polygon, need one click for each point of the shape.

In this situation, remember that **every click on the map starts drawing something**. To stop drawing when clicking on the map, use the `Disable` button in the same menu.

### Undo the latest thing drawn
Simply click on `Undo last draw`, in the upper buttons.

### Add metadata to the nodes
1. Be sure to have disabled the drawing mode;
2. Click on a node;
3. Use the info box to add metadata;
4. Click on submit.

Here the possible metadata to add to a node:
* a custom ID;
* a name for the node;
* a type that the node can have (for the time being this field is a simple string).

On the top of the info box is shown the node ID.

I **strongly suggest** you should add metadata before creating the graph (_see next section for details_), because after that the number of node with grow significantly. Every new node created from drawn version inherits all the metadata of its original node (except the ID, that is recreated).

### How to draw
If you want that two nodes will be connected by an edge, you **must** draw them overlapped, even by a single pixel. The best way is making sure that one side of one shape is completely included in the second shape. When you click on `Create graph`, the overlaps will be solved, making sure that each point of the surface of the store is contained at most by one node.

### Edit your shapes
If you want to change any shape you drew, click on the `Edit shapes` switch. Once clicked, you can click on the shape you want to modify: it is trivial to change the position of a point of the polygon, as well as adding a new side.

Once you are done, click back on the `Edit shapes` switch: the click action on a shape will be restored to the infobox with the metadata of the node.

## Create a graph
Click on `Create graph`. The system will:
* Resolve all the overlaps, choosing the resulting solution with the lowest number of points;
* Split the nodes that are too big on their longest size, every 5 meters. This will remove the original node, replacing it with a series of smaller ones, with all the metadata of the original one;
* Add edges between all the nodes that share at least one point;
* Add the zones of the supermarket in the metadata of each node. A zone is added if the node has at least one point in the zone itself.

## Import data
If you have a store layout graph to visualize, use the `Import data` button on the top of the page. Paste into the textarea the Json representation of your graph, in the following format:
```json
{
	"shapes": [
		{
	      "wkt": "POLYGON((84725 29870,84725 28720,82945 28720,82945 29870,84725 29870))",
	      "uuid": "3a8d0fe4-cf0d-4fe3-b7d2-5213cca57ab2",
	      "id": "Custom id",
	      "name": "Custom name",
	      "type": "Aisle",
	      "zones": [12345, 6789]
	    }
	],
	"edges": {
		"node1_uuid": [
			"node2_uuid", "node3_uuid"
		]
	}
}
```

## Export data
To export the graph you just drew, use the `Export data` button on the top of the page. The Json format is the same of aforementioned one.

# Technical details
## Dependencies
The web page needs 2 javascript files to work: `zones.js` and `data.js`.

### zones.js file
Such a file contains the data of the zones, in a variable called `zones`. It is structured as follows:
```json
[
	{
		"zoneId": 289996,
		"wkt": "POLYGON((132097 39356,133976 39356,133976 37045,154804 37045,154804 39356,158411 39356,158411 77761,132097 77761,132097 39356))",
		"type": "Division|Department|Aisle"}
]
```

### data.js file
Such a file contains the details of the supermarket, containing a list of environmentInfo. Only the first entry is used.

It has the maximum and minimum points on both the axes, and the base-64 image of the planimetry.

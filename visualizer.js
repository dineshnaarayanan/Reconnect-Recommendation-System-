/**
 * Interactive Force-Directed Social Graph Visualizer using HTML5 Canvas.
 * Implements physics simulation, interactive node dragging, tooltips,
 * and animated algorithm tracing effects.
 */

class SocialGraphVisualizer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) {
            throw new Error(`Canvas element with id "${canvasId}" not found.`);
        }
        this.ctx = this.canvas.getContext('2d');
        
        // Physics and nodes state
        this.graph = null;
        this.nodes = [];
        this.edges = [];
        this.nodesMap = new Map(); // id -> node reference
        this.highlights = { nodes: {}, edges: {} };
        
        // Dragging state
        this.draggedNode = null;
        this.hoveredNode = null;
        this.activeUserNodeId = null;
        this.pointerOffset = { x: 0, y: 0 };
        
        // Animation config
        this.dashOffset = 0;
        this.animationFrameId = null;
        this.pulseTime = 0;
        
        // Initialize event listeners
        this.initEvents();
        this.resize();
    }

    /**
     * Resizes the canvas to match its container dimension.
     */
    resize() {
        const rect = this.canvas.parentNode.getBoundingClientRect();
        this.canvas.width = rect.width * window.devicePixelRatio;
        this.canvas.height = Math.max(480, rect.height) * window.devicePixelRatio;
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
        this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    }

    /**
     * Synchronizes the visual nodes and edges with the SocialGraph data.
     * Preserves existing positions of nodes to maintain visual continuity.
     */
    syncWithGraph(socialGraph) {
        this.graph = socialGraph;
        const newNodes = [];
        const newNodesMap = new Map();
        
        // 1. Synchronize Nodes
        socialGraph.users.forEach((profile, id) => {
            let existingNode = this.nodesMap.get(id);
            if (!existingNode) {
                // Spawn new nodes near the center with a slight random spread
                const cx = this.canvas.width / (2 * window.devicePixelRatio);
                const cy = this.canvas.height / (2 * window.devicePixelRatio);
                existingNode = {
                    id: id,
                    name: profile.name,
                    title: profile.title,
                    company: profile.company,
                    avatarColor: profile.avatarColor,
                    skills: profile.skills,
                    x: cx + (Math.random() - 0.5) * 150,
                    y: cy + (Math.random() - 0.5) * 150,
                    vx: 0,
                    vy: 0,
                    radius: 26,
                    isDragging: false
                };
            }
            newNodes.push(existingNode);
            newNodesMap.set(id, existingNode);
        });
        
        this.nodes = newNodes;
        this.nodesMap = newNodesMap;

        // 2. Synchronize Edges
        this.edges = [];
        const processedEdges = new Set();
        
        socialGraph.adjList.forEach((neighbors, nodeAId) => {
            neighbors.forEach(nodeBId => {
                // Ensure unique bidirectional representation
                const edgeKey = [nodeAId, nodeBId].sort().join('-');
                if (!processedEdges.has(edgeKey)) {
                    processedEdges.add(edgeKey);
                    this.edges.push({
                        source: nodeAId,
                        target: nodeBId,
                        key: edgeKey
                    });
                }
            });
        });
    }

    /**
     * Highlights elements during simulation playback or item selection.
     */
    setHighlights(highlights) {
        this.highlights = highlights || { nodes: {}, edges: {} };
    }

    /**
     * Sets the active user to highlight them differently.
     */
    setActiveUser(userId) {
        this.activeUserNodeId = userId;
    }

    /**
     * Event handlers for drag and hover interactions.
     */
    initEvents() {
        // Pointer down (mouse click or touch start)
        this.canvas.addEventListener('pointerdown', (e) => {
            const pos = this.getPointerPos(e);
            this.draggedNode = this.getNodeAtPosition(pos.x, pos.y);
            if (this.draggedNode) {
                this.draggedNode.isDragging = true;
                this.pointerOffset.x = pos.x - this.draggedNode.x;
                this.pointerOffset.y = pos.y - this.draggedNode.y;
                this.canvas.setPointerCapture(e.pointerId);
                
                // Trigger customized callback for selecting active user on click
                if (this.onNodeClick) {
                    this.onNodeClick(this.draggedNode.id);
                }
            }
        });

        // Pointer move
        this.canvas.addEventListener('pointermove', (e) => {
            const pos = this.getPointerPos(e);
            
            if (this.draggedNode) {
                // Update position under mouse
                this.draggedNode.x = pos.x - this.pointerOffset.x;
                this.draggedNode.y = pos.y - this.pointerOffset.y;
                this.draggedNode.vx = 0;
                this.draggedNode.vy = 0;
            } else {
                // Detect hover
                const hover = this.getNodeAtPosition(pos.x, pos.y);
                if (hover !== this.hoveredNode) {
                    this.hoveredNode = hover;
                    this.canvas.style.cursor = hover ? 'pointer' : 'default';
                }
            }
        });

        // Pointer up/cancel
        const release = (e) => {
            if (this.draggedNode) {
                this.draggedNode.isDragging = false;
                this.draggedNode = null;
                try {
                    this.canvas.releasePointerCapture(e.pointerId);
                } catch(err) {}
            }
        };
        this.canvas.addEventListener('pointerup', release);
        this.canvas.addEventListener('pointercancel', release);

        // Resize observer
        window.addEventListener('resize', () => {
            this.resize();
        });
    }

    /**
     * Helper to compute canvas-relative coordinates.
     */
    getPointerPos(e) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }

    /**
     * Returns the node under coordinates x,y or null.
     */
    getNodeAtPosition(x, y) {
        for (const node of this.nodes) {
            const dx = x - node.x;
            const dy = y - node.y;
            if (dx * dx + dy * dy <= node.radius * node.radius) {
                return node;
            }
        }
        return null;
    }

    /**
     * Starts the physics updates and rendering loops.
     */
    start() {
        if (this.animationFrameId) return;
        
        const tick = () => {
            this.updatePhysics();
            this.render();
            
            this.dashOffset = (this.dashOffset + 0.3) % 20;
            this.pulseTime = (this.pulseTime + 0.05) % (Math.PI * 2);
            
            this.animationFrameId = requestAnimationFrame(tick);
        };
        this.animationFrameId = requestAnimationFrame(tick);
    }

    /**
     * Stops the simulation loops.
     */
    stop() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    /**
     * Hooke's Law and Coulomb's Law force calculations.
     */
    updatePhysics() {
        if (this.nodes.length === 0) return;

        const kRepulsion = 1800; // Strong repulsion to push nodes apart
        const kAttraction = 0.05; // Spring force along connections
        const restLength = 110;  // Preferred friendship length
        const kGravity = 0.02;    // Center gravity
        const damping = 0.82;     // Drag friction

        const width = this.canvas.width / window.devicePixelRatio;
        const height = this.canvas.height / window.devicePixelRatio;
        const cx = width / 2;
        const cy = height / 2;

        // 1. Repulsive forces between all nodes (N^2 cost, but N is small (10-30))
        for (let i = 0; i < this.nodes.length; i++) {
            const nodeA = this.nodes[i];
            for (let j = i + 1; j < this.nodes.length; j++) {
                const nodeB = this.nodes[j];

                const dx = nodeB.x - nodeA.x;
                const dy = nodeB.y - nodeA.y;
                let dist = Math.sqrt(dx * dx + dy * dy);
                if (dist === 0) dist = 0.1;

                // Coulomb repulsive force
                const force = kRepulsion / (dist * dist);
                const fx = (dx / dist) * force;
                const fy = (dy / dist) * force;

                if (!nodeA.isDragging) {
                    nodeA.vx -= fx;
                    nodeA.vy -= fy;
                }
                if (!nodeB.isDragging) {
                    nodeB.vx += fx;
                    nodeB.vy += fy;
                }
            }
        }

        // 2. Attractive spring force along edges
        for (const edge of this.edges) {
            const nodeA = this.nodesMap.get(edge.source);
            const nodeB = this.nodesMap.get(edge.target);
            if (!nodeA || !nodeB) continue;

            const dx = nodeB.x - nodeA.x;
            const dy = nodeB.y - nodeA.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 0.1;

            // Hooke's elastic force
            const force = kAttraction * (dist - restLength);
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;

            if (!nodeA.isDragging) {
                nodeA.vx += fx;
                nodeA.vy += fy;
            }
            if (!nodeB.isDragging) {
                nodeB.vx -= fx;
                nodeB.vy -= fy;
            }
        }

        // 3. Gravity pull toward viewport center & friction integration
        for (const node of this.nodes) {
            if (node.isDragging) continue;

            // Central gravity
            const dx = cx - node.x;
            const dy = cy - node.y;
            node.vx += dx * kGravity;
            node.vy += dy * kGravity;

            // Apply friction/drag
            node.vx *= damping;
            node.vy *= damping;

            // Update coordinate positions
            node.x += node.vx;
            node.y += node.vy;

            // Wall containment
            const margin = node.radius + 15;
            node.x = Math.max(margin, Math.min(width - margin, node.x));
            node.y = Math.max(margin, Math.min(height - margin, node.y));
        }
    }

    /**
     * Primary Canvas drawing loop.
     */
    render() {
        const width = this.canvas.width / window.devicePixelRatio;
        const height = this.canvas.height / window.devicePixelRatio;
        
        // Clear canvas
        this.ctx.clearRect(0, 0, width, height);

        // 1. Draw Edges (Friendship lines)
        this.edges.forEach(edge => {
            const nodeA = this.nodesMap.get(edge.source);
            const nodeB = this.nodesMap.get(edge.target);
            if (!nodeA || !nodeB) return;

            // Check if this edge is highlighted in active search paths
            let edgeHighlight = this.highlights.edges[edge.key] || 
                                this.highlights.edges[`${edge.target}-${edge.source}`];

            this.ctx.beginPath();
            this.ctx.moveTo(nodeA.x, nodeA.y);
            this.ctx.lineTo(nodeB.x, nodeB.y);

            if (edgeHighlight) {
                this.ctx.lineWidth = 3.5;
                if (edgeHighlight === 'path') {
                    // Glowing cyan DFS path
                    this.ctx.strokeStyle = '#00ADB5';
                    this.ctx.shadowColor = '#00ADB5';
                    this.ctx.shadowBlur = 10;
                } else if (edgeHighlight === 'traverse') {
                    // Glowing neon green traversal
                    this.ctx.strokeStyle = '#39FF14';
                    this.ctx.shadowBlur = 8;
                    this.ctx.shadowColor = '#39FF14';
                } else {
                    // Standard highlight
                    this.ctx.strokeStyle = '#8A2BE2';
                    this.ctx.shadowBlur = 6;
                    this.ctx.shadowColor = '#8A2BE2';
                }
                
                // Draw line
                this.ctx.stroke();
                
                // Draw marching ants dash flow animation
                this.ctx.save();
                this.ctx.beginPath();
                this.ctx.moveTo(nodeA.x, nodeA.y);
                this.ctx.lineTo(nodeB.x, nodeB.y);
                this.ctx.setLineDash([5, 8]);
                this.ctx.lineDashOffset = -this.dashOffset * 1.5;
                this.ctx.strokeStyle = '#FFFFFF';
                this.ctx.lineWidth = 1.5;
                this.ctx.shadowBlur = 0;
                this.ctx.stroke();
                this.ctx.restore();
            } else {
                // Standard default edge line (subtle and transparent)
                this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
                this.ctx.lineWidth = 1.5;
                this.ctx.shadowBlur = 0;
                this.ctx.stroke();
            }
        });
        
        // Reset shadow for nodes
        this.ctx.shadowBlur = 0;

        // 2. Draw Nodes
        this.nodes.forEach(node => {
            const nodeState = this.highlights.nodes[node.id];
            const isActiveUser = (node.id === this.activeUserNodeId);
            const isHovered = (node === this.hoveredNode);
            
            this.ctx.save();

            // Setup glowing styling depending on active states
            let strokeColor = 'rgba(255, 255, 255, 0.3)';
            let strokeWidth = 2;
            let drawPulse = false;

            if (nodeState) {
                drawPulse = true;
                switch (nodeState) {
                    case 'active':
                        strokeColor = '#00ADB5'; // Glowing Cyan
                        strokeWidth = 4;
                        this.ctx.shadowColor = '#00ADB5';
                        this.ctx.shadowBlur = 14;
                        break;
                    case 'processing':
                        strokeColor = '#FFD700'; // Glowing Gold
                        strokeWidth = 4;
                        this.ctx.shadowColor = '#FFD700';
                        this.ctx.shadowBlur = 12;
                        break;
                    case 'friend':
                        strokeColor = '#00D4B2'; // Neon Cyan/Mint
                        strokeWidth = 3.5;
                        this.ctx.shadowColor = '#00D4B2';
                        this.ctx.shadowBlur = 8;
                        break;
                    case 'recommendation':
                        strokeColor = '#BD93F9'; // LinkedIn Purple suggestion
                        strokeWidth = 4;
                        this.ctx.shadowColor = '#BD93F9';
                        this.ctx.shadowBlur = 12;
                        break;
                    case 'visited':
                        strokeColor = '#282A36'; // Dark Grey-Blue
                        strokeWidth = 2.5;
                        break;
                    case 'path':
                        strokeColor = '#00ADB5'; // Connection Path Cyan
                        strokeWidth = 4;
                        this.ctx.shadowColor = '#00ADB5';
                        this.ctx.shadowBlur = 12;
                        break;
                    case 'destination':
                        strokeColor = '#FF5555'; // Glowing Red destination
                        strokeWidth = 4;
                        this.ctx.shadowColor = '#FF5555';
                        this.ctx.shadowBlur = 14;
                        break;
                    case 'skipped':
                        strokeColor = '#FF6B6B'; // Soft Red-Pink
                        strokeWidth = 2;
                        break;
                }
            } else if (isActiveUser) {
                // Non-algorithm active user highlight
                strokeColor = '#00ADB5';
                strokeWidth = 4;
                this.ctx.shadowColor = '#00ADB5';
                this.ctx.shadowBlur = 12;
                drawPulse = true;
            } else if (isHovered) {
                strokeColor = '#FFFFFF';
                strokeWidth = 3;
                this.ctx.shadowColor = '#FFFFFF';
                this.ctx.shadowBlur = 8;
            }

            // Draw outer node pulse animation (for scanning nodes)
            if (drawPulse && !node.isDragging) {
                const pulseRadius = node.radius + (5 + Math.sin(this.pulseTime) * 4);
                this.ctx.beginPath();
                this.ctx.arc(node.x, node.y, pulseRadius, 0, Math.PI * 2);
                this.ctx.strokeStyle = this.fadeHex(strokeColor, 0.4);
                this.ctx.lineWidth = 1.5;
                this.ctx.stroke();
            }

            // Draw Core Node Circle
            this.ctx.beginPath();
            this.ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
            this.ctx.fillStyle = node.avatarColor || '#393E46';
            this.ctx.fill();

            // Set node boundary borders
            this.ctx.strokeStyle = strokeColor;
            this.ctx.lineWidth = strokeWidth;
            this.ctx.stroke();
            this.ctx.restore();

            // Draw User Initials (centered text inside circle)
            this.ctx.save();
            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.font = 'bold 15px "Outfit", "Inter", sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            
            // Extract Initials (e.g., Alice Vance -> AV)
            const initials = node.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
            this.ctx.fillText(initials, node.x, node.y);
            this.ctx.restore();

            // Draw Name Label (below circle)
            this.ctx.save();
            this.ctx.fillStyle = isHovered ? '#00ADB5' : '#EEEEEE';
            this.ctx.font = isHovered ? 'bold 12.5px "Outfit", sans-serif' : '11.5px "Outfit", sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(node.name, node.x, node.y + node.radius + 15);

            // Draw Company Label (small text below name)
            this.ctx.fillStyle = 'rgba(238, 238, 238, 0.6)';
            this.ctx.font = '9.5px "Outfit", sans-serif';
            this.ctx.fillText(node.company, node.x, node.y + node.radius + 27);
            this.ctx.restore();
            
            // Draw indicators like "+1" or "Active" badge above node
            if (nodeState === 'recommendation' || nodeState === 'friend' || isActiveUser) {
                this.ctx.save();
                this.ctx.beginPath();
                this.ctx.arc(node.x + 18, node.y - 18, 9, 0, Math.PI * 2);
                
                let badgeColor = '#BD93F9';
                let badgeText = '★';
                if (isActiveUser) {
                    badgeColor = '#00ADB5';
                    badgeText = 'Me';
                } else if (nodeState === 'friend') {
                    badgeColor = '#00D4B2';
                    badgeText = '1st';
                }
                
                this.ctx.fillStyle = badgeColor;
                this.ctx.fill();
                this.ctx.fillStyle = '#FFFFFF';
                this.ctx.font = 'bold 8.5px "Outfit", sans-serif';
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';
                this.ctx.fillText(badgeText, node.x + 18, node.y - 18);
                this.ctx.restore();
            }
        });

        // 3. Draw Hover Tooltip if node is hovered and not dragging
        if (this.hoveredNode && !this.draggedNode) {
            this.drawTooltip(this.hoveredNode);
        }
    }

    /**
     * Draws profile tooltip card on hover.
     */
    drawTooltip(node) {
        const padding = 12;
        const boxWidth = 210;
        
        // Extract connection degree representation
        let degree = '3rd+ Connection';
        if (this.activeUserNodeId) {
            if (node.id === this.activeUserNodeId) {
                degree = 'You (Active User)';
            } else if (this.graph.areFriends(node.id, this.activeUserNodeId)) {
                degree = '1st Connection (Friend)';
            } else {
                // BFS to see if mutuals exist
                const recs = this.graph.getRecommendations(this.activeUserNodeId);
                const recData = recs.find(r => r.user.id === node.id);
                if (recData) {
                    degree = `2nd Connection (${recData.mutualCount} Mutual Friend${recData.mutualCount > 1 ? 's' : ''})`;
                }
            }
        }

        const lines = [
            node.name,
            node.title,
            node.company,
            degree,
            `Skills: ${node.skills.slice(0, 3).join(', ')}`
        ];

        // Draw tooltip slightly above the node
        const tx = node.x - boxWidth / 2;
        const ty = node.y - node.radius - 105;
        const boxHeight = 94;

        this.ctx.save();
        
        // Frosted Glass Tooltip Backdrop
        this.ctx.fillStyle = 'rgba(23, 26, 32, 0.94)';
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        this.ctx.lineWidth = 1;
        this.ctx.shadowBlur = 10;
        this.ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        
        this.ctx.beginPath();
        this.roundRect(tx, ty, boxWidth, boxHeight, 8);
        this.ctx.fill();
        this.ctx.stroke();

        this.ctx.shadowBlur = 0; // reset shadow

        // Title (Name)
        this.ctx.fillStyle = '#EEEEEE';
        this.ctx.font = 'bold 12px "Outfit", sans-serif';
        this.ctx.fillText(lines[0], tx + padding, ty + padding + 6);

        // Title / Role
        this.ctx.fillStyle = 'rgba(238, 238, 238, 0.8)';
        this.ctx.font = '10.5px "Outfit", sans-serif';
        this.ctx.fillText(lines[1], tx + padding, ty + padding + 21);

        // Company
        this.ctx.fillStyle = 'rgba(238, 238, 238, 0.6)';
        this.ctx.font = '10px "Outfit", sans-serif';
        this.ctx.fillText(lines[2], tx + padding, ty + padding + 34);

        // Degree of separation
        this.ctx.fillStyle = '#00ADB5';
        this.ctx.font = 'bold 9.5px "Outfit", sans-serif';
        this.ctx.fillText(lines[3], tx + padding, ty + padding + 49);

        // Skills tag
        this.ctx.fillStyle = 'rgba(238, 238, 238, 0.5)';
        this.ctx.font = 'italic 9.5px "Outfit", sans-serif';
        this.ctx.fillText(lines[4], tx + padding, ty + padding + 65);

        this.ctx.restore();
    }

    /**
     * Canvas helper for rounded rectangles.
     */
    roundRect(x, y, width, height, radius) {
        if (typeof radius === 'number') {
            radius = {tl: radius, tr: radius, br: radius, bl: radius};
        }
        this.ctx.moveTo(x + radius.tl, y);
        this.ctx.lineTo(x + width - radius.tr, y);
        this.ctx.quadraticCurveTo(x + width, y, x + width, y + radius.tr);
        this.ctx.lineTo(x + width, y + height - radius.br);
        this.ctx.quadraticCurveTo(x + width, y + height, x + width - radius.br, y + height);
        this.ctx.lineTo(x + radius.bl, y + height);
        this.ctx.quadraticCurveTo(x, y + height, x, y + height - radius.bl);
        this.ctx.lineTo(x, y + radius.tl);
        this.ctx.quadraticCurveTo(x, y, x + radius.tl, y);
    }

    /**
     * Fades a hex color to rgba.
     */
    fadeHex(hex, alpha) {
        // Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
        const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
        hex = hex.replace(shorthandRegex, (m, r, g, b) => r + r + g + g + b + b);

        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        if (result) {
            const r = parseInt(result[1], 16);
            const g = parseInt(result[2], 16);
            const b = parseInt(result[3], 16);
            return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        }
        return hex;
    }
}

// Export if running in node, or attach to window for browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SocialGraphVisualizer;
} else {
    window.SocialGraphVisualizer = SocialGraphVisualizer;
}

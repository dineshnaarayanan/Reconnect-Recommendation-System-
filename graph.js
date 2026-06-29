/**
 * Social Network Graph implementation using HashMap-based Adjacency List.
 * Includes BFS and DFS algorithms, mutual connection calculations,
 * and step-by-step trace generator functions for visual simulation.
 */

class SocialGraph {
    constructor() {
        // Adjacency List: Map<userId, Set<userId>> (HashMap of user relationships)
        this.adjList = new Map();
        // Users Table: Map<userId, UserProfile> (HashMap of user details)
        this.users = new Map();
    }

    /**
     * Adds a new user node to the graph.
     */
    addUser(id, name, title, company, skills = [], avatarColor = '#00ADB5') {
        if (!id) return false;
        if (!this.users.has(id)) {
            this.users.set(id, { id, name, title, company, skills, avatarColor });
            this.adjList.set(id, new Set());
            return true;
        }
        return false;
    }

    /**
     * Removes a user and all their friendships from the graph.
     */
    removeUser(id) {
        if (!this.users.has(id)) return false;

        // Remove friendships in neighbors' lists
        const neighbors = this.adjList.get(id);
        for (const neighborId of neighbors) {
            this.adjList.get(neighborId).delete(id);
        }

        // Delete user record and adjacency list entry
        this.adjList.delete(id);
        this.users.delete(id);
        return true;
    }

    /**
     * Adds a bi-directional edge (friendship) between two users.
     */
    addEdge(id1, id2) {
        if (!this.users.has(id1) || !this.users.has(id2)) return false;
        if (id1 === id2) return false;

        this.adjList.get(id1).add(id2);
        this.adjList.get(id2).add(id1);
        return true;
    }

    /**
     * Removes a friendship edge between two users.
     */
    removeEdge(id1, id2) {
        if (!this.users.has(id1) || !this.users.has(id2)) return false;

        this.adjList.get(id1).delete(id2);
        this.adjList.get(id2).delete(id1);
        return true;
    }

    /**
     * Checks if two users are direct friends.
     */
    areFriends(id1, id2) {
        if (!this.adjList.has(id1)) return false;
        return this.adjList.get(id1).has(id2);
    }

    /**
     * Gets all direct friends of a user.
     */
    getFriends(id) {
        return this.adjList.get(id) || new Set();
    }

    /**
     * Get friend recommendations for a user.
     * Recommendations are "friends of friends" (distance 2) who are not already friends.
     * Ranked by the number of mutual connections.
     * Uses a HashMap to calculate mutual connection counts.
     */
    getRecommendations(userId) {
        if (!this.users.has(userId)) return [];

        const friends = this.getFriends(userId);
        // HashMap: recommendationId -> Array of mutual friend IDs
        const mutualsMap = new Map();

        // 1. Iterate through all direct friends (Distance 1)
        for (const friendId of friends) {
            const friendsOfFriend = this.getFriends(friendId);

            // 2. Iterate through friends of friends (Distance 2)
            for (const fofId of friendsOfFriend) {
                // Cannot recommend self, or someone who is already a direct friend
                if (fofId === userId || friends.has(fofId)) continue;

                if (!mutualsMap.has(fofId)) {
                    mutualsMap.set(fofId, []);
                }
                // Record the mutual friend that connects them
                mutualsMap.get(fofId).push(friendId);
            }
        }

        // Convert the map to a sorted array of recommendations
        const recommendations = [];
        mutualsMap.forEach((mutuals, recId) => {
            const userProfile = this.users.get(recId);
            if (userProfile) {
                recommendations.push({
                    user: userProfile,
                    mutualFriends: mutuals,
                    mutualCount: mutuals.length
                });
            }
        });

        // Sort by mutual count descending
        return recommendations.sort((a, b) => b.mutualCount - a.mutualCount);
    }

    /**
     * Generates a step-by-step trace of BFS Recommendation calculation.
     * Used by the Simulator UI to replay the algorithm.
     */
    generateBFSTrace(startId) {
        const trace = [];
        if (!this.users.has(startId)) return trace;

        const friends = this.getFriends(startId);
        const queue = [];
        const visited = new Set();
        const mutualsMap = new Map(); // recId -> array of mutual friend IDs

        // Phase 1: Initialize
        visited.add(startId);
        // We push [nodeId, parentId, depth]
        // start node has depth 0
        queue.push({ id: startId, parent: null, depth: 0 });

        trace.push({
            stepType: 'START',
            activeNode: startId,
            queue: [...queue],
            visited: [...visited],
            mutuals: new Map(mutualsMap),
            message: `Starting BFS from Active User: ${this.users.get(startId).name}. Initializing queue with depth 0.`,
            highlights: { nodes: { [startId]: 'active' }, edges: {} }
        });

        // Let's store direct friends in a set for easy trace descriptions
        const directFriends = new Set(friends);

        // BFS Loop
        while (queue.length > 0) {
            const current = queue.shift();
            const currId = current.id;
            const currDepth = current.depth;

            trace.push({
                stepType: 'DEQUEUE',
                activeNode: currId,
                queue: [...queue],
                visited: [...visited],
                mutuals: new Map(mutualsMap),
                message: `Dequeued ${this.users.get(currId).name} (Depth ${currDepth}). Examining connections.`,
                highlights: {
                    nodes: { [startId]: 'active', [currId]: 'processing' },
                    edges: current.parent ? { [`${current.parent}-${currId}`]: 'highlight' } : {}
                }
            });

            // If we are at depth >= 2, we don't enqueue further neighbors for LinkedIn recommendations (typically distance 2)
            if (currDepth >= 2) {
                trace.push({
                    stepType: 'SKIP_NEIGHBORS',
                    activeNode: currId,
                    queue: [...queue],
                    visited: [...visited],
                    mutuals: new Map(mutualsMap),
                    message: `${this.users.get(currId).name} is at Depth ${currDepth}. Skipping neighbor exploration to limit recommendations to Friends of Friends (Max Depth 2).`,
                    highlights: { nodes: { [startId]: 'active', [currId]: 'skipped' }, edges: {} }
                });
                continue;
            }

            const neighbors = Array.from(this.getFriends(currId));

            for (const neighborId of neighbors) {
                const neighborName = this.users.get(neighborId).name;
                const isVisited = visited.has(neighborId);
                const nextDepth = currDepth + 1;

                // Case: Neighbor is the start user itself - skip
                if (neighborId === startId) continue;

                if (!isVisited) {
                    visited.add(neighborId);
                    queue.push({ id: neighborId, parent: currId, depth: nextDepth });

                    let msg = `Found new connection: ${neighborName} (Depth ${nextDepth}). Enqueued and marked visited.`;
                    const nodeStates = { [startId]: 'active', [currId]: 'processing', [neighborId]: 'visited' };

                    // If we reached distance 2, we have a recommendation candidate!
                    if (nextDepth === 2 && !directFriends.has(neighborId)) {
                        if (!mutualsMap.has(neighborId)) {
                            mutualsMap.set(neighborId, []);
                        }
                        mutualsMap.get(neighborId).push(currId);
                        msg = `Found potential recommendation: ${neighborName} via mutual friend ${this.users.get(currId).name}. Added to HashMap.`;
                        nodeStates[neighborId] = 'recommendation';
                    } else if (nextDepth === 1) {
                        nodeStates[neighborId] = 'friend';
                    }

                    trace.push({
                        stepType: 'ENQUEUE',
                        activeNode: neighborId,
                        queue: [...queue],
                        visited: [...visited],
                        mutuals: new Map(mutualsMap),
                        message: msg,
                        highlights: {
                            nodes: nodeStates,
                            edges: { [`${currId}-${neighborId}`]: 'traverse' }
                        }
                    });
                } else {
                    // Node is already visited. Let's check if it's a distance-2 recommendation node reached via a different path
                    // This reveals an additional mutual friend!
                    if (nextDepth === 2 && !directFriends.has(neighborId)) {
                        if (!mutualsMap.has(neighborId)) {
                            mutualsMap.set(neighborId, []);
                        }
                        // Avoid duplicates if we somehow process it twice
                        if (!mutualsMap.get(neighborId).includes(currId)) {
                            mutualsMap.get(neighborId).push(currId);
                        }

                        trace.push({
                            stepType: 'MUTUAL_INC',
                            activeNode: neighborId,
                            queue: [...queue],
                            visited: [...visited],
                            mutuals: new Map(mutualsMap),
                            message: `Already visited ${neighborName}. But found another path through ${this.users.get(currId).name}! Adding to mutual friend HashMap (Total mutuals: ${mutualsMap.get(neighborId).length}).`,
                            highlights: {
                                nodes: { [startId]: 'active', [currId]: 'processing', [neighborId]: 'recommendation' },
                                edges: { [`${currId}-${neighborId}`]: 'traverse' }
                            }
                        });
                    } else {
                        trace.push({
                            stepType: 'ALREADY_VISITED',
                            activeNode: neighborId,
                            queue: [...queue],
                            visited: [...visited],
                            mutuals: new Map(mutualsMap),
                            message: `Connection ${neighborName} already visited. Skipping queue insertion.`,
                            highlights: {
                                nodes: { [startId]: 'active', [currId]: 'processing', [neighborId]: 'visited' },
                                edges: {}
                            }
                        });
                    }
                }
            }
        }

        // Finalize trace
        const sortedRecs = [];
        mutualsMap.forEach((mutuals, recId) => {
            sortedRecs.push({
                user: this.users.get(recId),
                mutuals: mutuals,
                count: mutuals.length
            });
        });
        sortedRecs.sort((a, b) => b.count - a.count);

        trace.push({
            stepType: 'DONE',
            activeNode: startId,
            queue: [],
            visited: [...visited],
            mutuals: new Map(mutualsMap),
            finalRecommendations: sortedRecs,
            message: `BFS completed! Identified ${sortedRecs.length} suggestions, ranked using mutual friend frequencies from the HashMap.`,
            highlights: { nodes: { [startId]: 'active' }, edges: {} }
        });

        return trace;
    }

    /**
     * Finds the shortest path between two users using BFS.
     * Returns an array of node IDs representing the path, or null if none.
     */
    findShortestPathBFS(startId, targetId) {
        if (!this.users.has(startId) || !this.users.has(targetId)) return null;
        if (startId === targetId) return [startId];

        const queue = [startId];
        const visited = new Set([startId]);
        const parentMap = new Map(); // childId -> parentId

        while (queue.length > 0) {
            const current = queue.shift();

            if (current === targetId) {
                // Reconstruct path
                const path = [];
                let curr = targetId;
                while (curr) {
                    path.push(curr);
                    curr = parentMap.get(curr);
                }
                return path.reverse();
            }

            const neighbors = this.getFriends(current);
            for (const neighbor of neighbors) {
                if (!visited.has(neighbor)) {
                    visited.add(neighbor);
                    parentMap.set(neighbor, current);
                    queue.push(neighbor);
                }
            }
        }

        return null; // No path found
    }

    /**
     * Generates a step-by-step trace of DFS finding all paths between two users.
     */
    generateDFSTrace(startId, targetId, maxDepth = 4) {
        const trace = [];
        if (!this.users.has(startId) || !this.users.has(targetId)) return trace;

        const pathStack = []; // Current DFS path
        const visited = new Set();
        const allPaths = [];

        const dfs = (nodeId, depth) => {
            visited.add(nodeId);
            pathStack.push(nodeId);

            const nodeName = this.users.get(nodeId).name;

            // Generate highlights for the current state
            const currentHighlights = {
                nodes: {},
                edges: {}
            };
            pathStack.forEach((id, idx) => {
                if (idx === pathStack.length - 1) {
                    currentHighlights.nodes[id] = 'active'; // Current DFS tip
                } else {
                    currentHighlights.nodes[id] = 'path'; // On current path
                }
                if (idx > 0) {
                    currentHighlights.edges[`${pathStack[idx-1]}-${id}`] = 'path';
                }
            });

            trace.push({
                stepType: 'DFS_VISIT',
                activeNode: nodeId,
                stack: [...pathStack],
                visited: [...visited],
                message: `DFS visiting ${nodeName} (Depth ${depth}). Current path: ${pathStack.map(id => this.users.get(id).name).join(' -> ')}`,
                highlights: { ...currentHighlights }
            });

            if (nodeId === targetId) {
                const foundPath = [...pathStack];
                allPaths.push(foundPath);
                trace.push({
                    stepType: 'DFS_FOUND',
                    activeNode: nodeId,
                    stack: [...pathStack],
                    visited: [...visited],
                    message: `DFS reached destination ${nodeName}! Path Found: ${foundPath.map(id => this.users.get(id).name).join(' ➔ ')}. Backtracking...`,
                    highlights: {
                        nodes: { ...currentHighlights.nodes, [targetId]: 'destination' },
                        edges: { ...currentHighlights.edges }
                    }
                });
            } else if (depth >= maxDepth) {
                trace.push({
                    stepType: 'DFS_DEPTH_LIMIT',
                    activeNode: nodeId,
                    stack: [...pathStack],
                    visited: [...visited],
                    message: `DFS reached maximum depth limit (${maxDepth}). Backtracking from ${nodeName}...`,
                    highlights: { ...currentHighlights }
                });
            } else {
                const neighbors = Array.from(this.getFriends(nodeId));
                for (const neighborId of neighbors) {
                    const neighborName = this.users.get(neighborId).name;

                    if (!pathStack.includes(neighborId)) { // Avoid cycle on active path
                        dfs(neighborId, depth + 1);
                    } else {
                        trace.push({
                            stepType: 'DFS_CYCLE_SKIP',
                            activeNode: neighborId,
                            stack: [...pathStack],
                            visited: [...visited],
                            message: `Connection ${neighborName} is already in the current call stack. Skipping to prevent infinite recursion/cycles.`,
                            highlights: {
                                nodes: { ...currentHighlights.nodes, [neighborId]: 'visited' },
                                edges: {}
                            }
                        });
                    }
                }
            }

            // Backtrack
            pathStack.pop();
            visited.delete(nodeId);

            if (pathStack.length > 0) {
                const parentId = pathStack[pathStack.length - 1];
                const parentName = this.users.get(parentId).name;
                
                // Redraw highlights for backtrack parent
                const backtrackHighlights = { nodes: {}, edges: {} };
                pathStack.forEach((id, idx) => {
                    backtrackHighlights.nodes[id] = (idx === pathStack.length - 1) ? 'active' : 'path';
                    if (idx > 0) backtrackHighlights.edges[`${pathStack[idx-1]}-${id}`] = 'path';
                });

                trace.push({
                    stepType: 'DFS_BACKTRACK',
                    activeNode: parentId,
                    stack: [...pathStack],
                    visited: [...visited],
                    message: `Backtracked to ${parentName}. Restoring call stack frame.`,
                    highlights: { ...backtrackHighlights }
                });
            }
        };

        trace.push({
            stepType: 'DFS_START',
            activeNode: startId,
            stack: [],
            visited: [],
            message: `Starting Depth First Search (DFS) path discovery from ${this.users.get(startId).name} to ${this.users.get(targetId).name}.`,
            highlights: { nodes: { [startId]: 'active', [targetId]: 'destination' }, edges: {} }
        });

        dfs(startId, 0);

        trace.push({
            stepType: 'DFS_DONE',
            activeNode: startId,
            stack: [],
            visited: [],
            allPaths: allPaths,
            message: `DFS search completed! Found a total of ${allPaths.length} unique paths within depth limit ${maxDepth}.`,
            highlights: { nodes: { [startId]: 'active', [targetId]: 'destination' }, edges: {} }
        });

        return trace;
    }
}

// Export class if running in node, or attach to window for browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SocialGraph;
} else {
    window.SocialGraph = SocialGraph;
}

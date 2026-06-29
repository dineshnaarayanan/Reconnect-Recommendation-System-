/**
 * Reconnect Main Application Controller
 * Handles UI interactions, seeding, event bindings, and the step-by-step
 * DSA algorithm simulation player.
 */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize core graph and seed data
    const graph = new SocialGraph();
    seedGraph(graph);

    // 2. Initialize visualizer
    const visualizer = new SocialGraphVisualizer('graphCanvas');
    visualizer.syncWithGraph(graph);
    
    // Set initial focus user
    let activeUserId = 'u1'; 
    visualizer.setActiveUser(activeUserId);
    visualizer.start();

    // 3. Simulation Playback State
    let simulationTrace = [];
    let currentStepIdx = -1;
    let simTimer = null;
    let isPlaying = false;
    let activeSimAlgo = 'bfs-rec'; // 'bfs-rec' or 'dfs-path'
    let dfsTargetId = 'u10'; // Default target for DFS path search

    // 4. UI Elements Cache
    const activeUserSelect = document.getElementById('activeUserSelect');
    const edgeUser1 = document.getElementById('edgeUser1');
    const edgeUser2 = document.getElementById('edgeUser2');
    const pathStart = document.getElementById('pathStart');
    const pathEnd = document.getElementById('pathEnd');
    
    const activeProfileCard = document.getElementById('activeProfileCard');
    const recommendationsList = document.getElementById('recommendationsList');
    const friendsList = document.getElementById('friendsList');
    const networkStatsText = document.getElementById('networkStatsText');

    // Simulation controls
    const algorithmSelect = document.getElementById('algorithmSelect');
    const simPlayBtn = document.getElementById('simPlayBtn');
    const simPrevBtn = document.getElementById('simPrevBtn');
    const simNextBtn = document.getElementById('simNextBtn');
    const simStopBtn = document.getElementById('simStopBtn');
    const simSpeedSlider = document.getElementById('simSpeedSlider');
    const dsaAlgoTitle = document.getElementById('dsaAlgoTitle');
    const dsaStepCounter = document.getElementById('dsaStepCounter');
    
    // DS containers
    const dsQueueLabel = document.getElementById('dsQueueLabel');
    const dsQueueContainer = document.getElementById('dsQueueContainer');
    const dsVisitedContainer = document.getElementById('dsVisitedContainer');
    const consoleLogs = document.getElementById('consoleLogs');
    const hashmapInspectorDiv = document.getElementById('hashmapInspectorDiv');
    const hashmapInspectorTable = document.getElementById('hashmapInspectorTable');

    // Modals
    const addUserModal = document.getElementById('addUserModal');
    const openAddUserModalBtn = document.getElementById('openAddUserModalBtn');
    const closeAddUserModalBtn = document.getElementById('closeAddUserModalBtn');
    const cancelAddUserBtn = document.getElementById('cancelAddUserBtn');
    const saveUserBtn = document.getElementById('saveUserBtn');

    // 5. Populate dropdowns helper
    function populateDropdowns() {
        const sortedUsers = Array.from(graph.users.values()).sort((a, b) => a.name.localeCompare(b.name));
        
        // Save current selections
        const prevActive = activeUserSelect.value || activeUserId;
        const prevEdge1 = edgeUser1.value;
        const prevEdge2 = edgeUser2.value;
        const prevPathStart = pathStart.value;
        const prevPathEnd = pathEnd.value;

        // Clear
        activeUserSelect.innerHTML = '';
        edgeUser1.innerHTML = '';
        edgeUser2.innerHTML = '';
        pathStart.innerHTML = '';
        pathEnd.innerHTML = '';

        sortedUsers.forEach(user => {
            const createOpt = (val, text) => {
                const opt = document.createElement('option');
                opt.value = val;
                opt.textContent = text;
                return opt;
            };

            activeUserSelect.appendChild(createOpt(user.id, user.name));
            edgeUser1.appendChild(createOpt(user.id, user.name));
            edgeUser2.appendChild(createOpt(user.id, user.name));
            pathStart.appendChild(createOpt(user.id, user.name));
            pathEnd.appendChild(createOpt(user.id, user.name));
        });

        // Restore selections
        if (graph.users.has(prevActive)) activeUserSelect.value = prevActive;
        if (graph.users.has(prevEdge1)) edgeUser1.value = prevEdge1;
        if (graph.users.has(prevEdge2)) edgeUser2.value = prevEdge2;
        if (graph.users.has(prevPathStart)) pathStart.value = prevPathStart;
        if (graph.users.has(prevPathEnd)) pathEnd.value = prevPathEnd;
    }

    // 6. Update Network Stats overlay
    function updateStats() {
        const userCount = graph.users.size;
        let edgeCount = 0;
        graph.adjList.forEach(neighbors => {
            edgeCount += neighbors.size;
        });
        edgeCount = edgeCount / 2; // bidirectional

        networkStatsText.textContent = `${userCount} Users, ${edgeCount} Friendships`;
    }

    // 7. Render Active User Workspace
    function selectActiveUser(userId) {
        if (!graph.users.has(userId)) return;
        activeUserId = userId;
        visualizer.setActiveUser(userId);
        
        // Update select value if not matching
        if (activeUserSelect.value !== userId) {
            activeUserSelect.value = userId;
        }

        const user = graph.users.get(userId);
        
        // A. Profile Card
        activeProfileCard.innerHTML = `
            <div class="avatar-large" style="background-color: ${user.avatarColor};">
                ${user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
            </div>
            <div class="profile-info">
                <div class="profile-name">${user.name}</div>
                <div class="profile-title">${user.title}</div>
                <div class="profile-company">at ${user.company}</div>
                <div class="skills-tags">
                    ${user.skills.map(s => `<span class="tag tag-primary">${s}</span>`).join('')}
                </div>
            </div>
        `;

        // B. Recommendations List (HashMap BFS based)
        const recs = graph.getRecommendations(userId);
        recommendationsList.innerHTML = '';
        
        if (recs.length === 0) {
            recommendationsList.innerHTML = `<div class="empty-state">No recommendation candidates. Add connections or users to expand network.</div>`;
        } else {
            recs.forEach(rec => {
                const recUser = rec.user;
                const initials = recUser.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
                
                const item = document.createElement('div');
                item.className = 'rec-item';
                item.innerHTML = `
                    <div class="item-left">
                        <div class="avatar-small" style="background-color: ${recUser.avatarColor};">${initials}</div>
                        <div class="item-info">
                            <div class="item-name">${recUser.name}</div>
                            <div class="item-meta">${recUser.title} at ${recUser.company}</div>
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span class="mutual-badge" title="Mutual friends: ${rec.mutualFriends.map(id => graph.users.get(id).name).join(', ')}">
                            ${rec.mutualCount} Mutual${rec.mutualCount > 1 ? 's' : ''}
                        </span>
                        <button class="action-icon-btn add-friend" data-id="${recUser.id}" title="Connect with ${recUser.name}">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
                        </button>
                    </div>
                `;
                recommendationsList.appendChild(item);
            });

            // Bind connect suggestions action
            recommendationsList.querySelectorAll('.add-friend').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const targetId = btn.getAttribute('data-id');
                    graph.addEdge(activeUserId, targetId);
                    visualizer.syncWithGraph(graph);
                    selectActiveUser(activeUserId);
                    updateStats();
                    showConsoleInfo(`Connected ${graph.users.get(activeUserId).name} and ${graph.users.get(targetId).name}.`);
                });
            });
        }

        // C. Direct connections list
        const friends = Array.from(graph.getFriends(userId)).sort((a,b) => graph.users.get(a).name.localeCompare(graph.users.get(b).name));
        friendsList.innerHTML = '';
        
        if (friends.length === 0) {
            friendsList.innerHTML = `<div class="empty-state">No direct connections yet. Connect profiles in the Control Deck.</div>`;
        } else {
            friends.forEach(fId => {
                const friend = graph.users.get(fId);
                const initials = friend.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
                
                const item = document.createElement('div');
                item.className = 'friend-item';
                item.innerHTML = `
                    <div class="item-left">
                        <div class="avatar-small" style="background-color: ${friend.avatarColor};">${initials}</div>
                        <div class="item-info">
                            <div class="item-name">${friend.name}</div>
                            <div class="item-meta">${friend.company}</div>
                        </div>
                    </div>
                    <button class="action-icon-btn remove-friend" data-id="${friend.id}" title="Remove Connection">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                `;
                friendsList.appendChild(item);
            });

            // Bind remove friendship action
            friendsList.querySelectorAll('.remove-friend').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const targetId = btn.getAttribute('data-id');
                    graph.removeEdge(activeUserId, targetId);
                    visualizer.syncWithGraph(graph);
                    selectActiveUser(activeUserId);
                    updateStats();
                    showConsoleInfo(`Removed friendship connection between ${graph.users.get(activeUserId).name} and ${graph.users.get(targetId).name}.`);
                });
            });
        }
    }

    // 8. Simple logger console display
    function clearLogs() {
        consoleLogs.innerHTML = '';
    }

    function addLogEntry(text, type = 'info') {
        const entry = document.createElement('div');
        entry.className = `log-entry ${type}`;
        entry.textContent = text;
        consoleLogs.appendChild(entry);
        consoleLogs.scrollTop = consoleLogs.scrollHeight;
    }

    function showConsoleInfo(msg) {
        clearLogs();
        addLogEntry(msg, 'info');
    }

    // 9. Simulation Player Controls & Operations
    function resetSimulationUI() {
        stopSimulation();
        clearLogs();
        addLogEntry("Simulation reset. Select play to begin.", "info");
        dsQueueContainer.innerHTML = `<span class="empty-state" style="padding: 0; font-size: 0.72rem; width: 100%; text-align: left;">Empty structure. Click Play to initialize.</span>`;
        dsVisitedContainer.innerHTML = `<span class="empty-state" style="padding: 0; font-size: 0.72rem; width: 100%; text-align: left;">Visited list is empty.</span>`;
        hashmapInspectorTable.innerHTML = `<tr><td colspan="3" style="color: var(--text-muted); font-style: italic; text-align: center;">HashMap is empty</td></tr>`;
        dsaStepCounter.textContent = 'Step: - / -';
        visualizer.setHighlights(null);
    }

    function stopSimulation() {
        isPlaying = false;
        simPlayBtn.textContent = '▶';
        if (simTimer) {
            clearInterval(simTimer);
            simTimer = null;
        }
        simPrevBtn.disabled = true;
        simNextBtn.disabled = true;
        simStopBtn.disabled = true;
    }

    function generateSimulationTrace() {
        activeSimAlgo = algorithmSelect.value;
        if (activeSimAlgo === 'bfs-rec') {
            dsaAlgoTitle.textContent = 'BFS RECOMMENDATION LOGGER';
            dsQueueLabel.textContent = 'Queue (FIFO)';
            hashmapInspectorDiv.style.display = 'flex';
            simulationTrace = graph.generateBFSTrace(activeUserId);
        } else {
            dsaAlgoTitle.textContent = 'DFS PATHFINDER STACK';
            dsQueueLabel.textContent = 'Stack (LIFO)';
            hashmapInspectorDiv.style.display = 'none';
            simulationTrace = graph.generateDFSTrace(activeUserId, dfsTargetId);
        }
        currentStepIdx = 0;
    }

    /**
     * Renders a specific frame (step index) of the algorithm trace into the UI.
     */
    function renderSimulationStep(idx) {
        if (idx < 0 || idx >= simulationTrace.length) return;
        currentStepIdx = idx;
        
        const step = simulationTrace[idx];
        dsaStepCounter.textContent = `Step: ${idx + 1} / ${simulationTrace.length}`;

        // 1. Highlight graph visualizer nodes/edges
        visualizer.setHighlights(step.highlights);

        // 2. Render Queue / Stack row
        dsQueueContainer.innerHTML = '';
        const items = step.queue || step.stack || [];
        
        if (items.length === 0) {
            dsQueueContainer.innerHTML = `<span class="empty-state" style="padding: 0; font-size: 0.72rem; width: 100%; text-align: left;">Empty structure.</span>`;
        } else {
            items.forEach((itemObj, i) => {
                const id = typeof itemObj === 'string' ? itemObj : itemObj.id;
                const nodeName = graph.users.get(id).name.split(' ')[0]; // just first name
                
                const chip = document.createElement('span');
                chip.className = 'ds-chip';
                if (id === step.activeNode) chip.classList.add('processing');
                chip.textContent = nodeName;
                dsQueueContainer.appendChild(chip);

                // Draw separators between elements
                if (i < items.length - 1) {
                    const arrow = document.createElement('span');
                    arrow.className = 'ds-arrow';
                    arrow.textContent = activeSimAlgo === 'bfs-rec' ? '➔' : ' '; // stack doesn't need flow direction arrows
                    dsQueueContainer.appendChild(arrow);
                }
            });
        }

        // 3. Render Visited Set
        dsVisitedContainer.innerHTML = '';
        const visitedList = step.visited || [];
        if (visitedList.length === 0) {
            dsVisitedContainer.innerHTML = `<span class="empty-state" style="padding: 0; font-size: 0.72rem; width: 100%; text-align: left;">Empty set.</span>`;
        } else {
            visitedList.forEach(id => {
                const name = graph.users.get(id).name;
                const chip = document.createElement('span');
                chip.className = 'ds-chip visited';
                chip.textContent = name;
                dsVisitedContainer.appendChild(chip);
            });
        }

        // 4. Update Logs console
        // We output log histories up to the current index
        clearLogs();
        for (let i = 0; i <= idx; i++) {
            const prevStep = simulationTrace[i];
            let type = 'info';
            if (prevStep.stepType === 'START') type = 'start';
            else if (prevStep.stepType === 'DONE') type = 'done';
            else if (prevStep.stepType === 'DEQUEUE' || prevStep.stepType === 'DFS_VISIT') type = 'dequeue';
            else if (prevStep.stepType === 'ENQUEUE') type = 'enqueue';
            else if (prevStep.stepType === 'MUTUAL_INC') type = 'rec';
            else if (prevStep.stepType === 'DFS_FOUND') type = 'done';
            else if (prevStep.stepType === 'DFS_BACKTRACK') type = 'info';

            addLogEntry(prevStep.message, type);
        }

        // 5. Render HashMap Table (BFS Suggestions exclusive)
        if (activeSimAlgo === 'bfs-rec') {
            hashmapInspectorTable.innerHTML = '';
            const mutuals = step.mutuals; // JS Map
            
            if (!mutuals || mutuals.size === 0) {
                hashmapInspectorTable.innerHTML = `<tr><td colspan="3" style="color: var(--text-muted); font-style: italic; text-align: center;">HashMap is empty</td></tr>`;
            } else {
                // sort by mutual connection size descending
                const sortedMapEntries = Array.from(mutuals.entries()).sort((a,b) => b[1].length - a[1].length);
                
                sortedMapEntries.forEach(([recId, mutualIds]) => {
                    const name = graph.users.get(recId).name;
                    const pathStrings = mutualIds.map(id => graph.users.get(id).name).join(', ');
                    
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td style="font-weight: 500; color: var(--text-primary);">${name}</td>
                        <td style="color: var(--text-muted); font-size: 0.68rem;">[${pathStrings}]</td>
                        <td class="val-cell">${mutualIds.length}</td>
                    `;
                    hashmapInspectorTable.appendChild(tr);
                });
            }
        }

        // Enable / Disable manual click steps
        simPrevBtn.disabled = (idx === 0);
        simNextBtn.disabled = (idx === simulationTrace.length - 1);
        simStopBtn.disabled = false;
        
        // Auto-pause if we hit the end during active playback
        if (idx === simulationTrace.length - 1 && isPlaying) {
            stopSimulation();
        }
    }

    // Playback loop runner
    function playSimulationLoop() {
        const speed = parseInt(simSpeedSlider.value);
        simTimer = setInterval(() => {
            if (currentStepIdx < simulationTrace.length - 1) {
                renderSimulationStep(currentStepIdx + 1);
            } else {
                stopSimulation();
            }
        }, speed);
    }

    // Play/Pause Action
    simPlayBtn.addEventListener('click', () => {
        if (isPlaying) {
            // Pause
            isPlaying = false;
            simPlayBtn.textContent = '▶';
            if (simTimer) {
                clearInterval(simTimer);
                simTimer = null;
            }
        } else {
            // Play
            isPlaying = true;
            simPlayBtn.textContent = '⏸';
            
            // Generate fresh trace if at start/reset state
            if (currentStepIdx === -1 || currentStepIdx === simulationTrace.length - 1) {
                generateSimulationTrace();
            }
            
            renderSimulationStep(currentStepIdx);
            playSimulationLoop();
        }
    });

    // Step Next Action
    simNextBtn.addEventListener('click', () => {
        if (currentStepIdx < simulationTrace.length - 1) {
            renderSimulationStep(currentStepIdx + 1);
        }
    });

    // Step Previous Action
    simPrevBtn.addEventListener('click', () => {
        if (currentStepIdx > 0) {
            renderSimulationStep(currentStepIdx - 1);
        }
    });

    // Stop / Reset Action
    simStopBtn.addEventListener('click', resetSimulationUI);

    // Speed slider update speed dynamically
    simSpeedSlider.addEventListener('input', () => {
        if (isPlaying) {
            clearInterval(simTimer);
            playSimulationLoop();
        }
    });

    // 10. Forms / Operations Logic
    
    // Accordion expand/collapse
    document.querySelectorAll('.accordion-trigger').forEach(trigger => {
        trigger.addEventListener('click', () => {
            const targetId = trigger.getAttribute('data-target');
            const targetContent = document.getElementById(targetId);
            const isVisible = targetContent.style.display !== 'none';
            
            // Toggle
            targetContent.style.display = isVisible ? 'none' : 'flex';
            
            // Rotate chevron
            const svg = trigger.querySelector('svg');
            if (isVisible) {
                svg.style.transform = 'rotate(0deg)';
            } else {
                svg.style.transform = 'rotate(180deg)';
            }
        });
    });

    // Save New User
    saveUserBtn.addEventListener('click', () => {
        const name = document.getElementById('newUserName').value.trim();
        const title = document.getElementById('newUserTitle').value.trim();
        const company = document.getElementById('newUserCompany').value.trim();
        const skillsString = document.getElementById('newUserSkills').value;
        const color = document.getElementById('newUserColor').value;

        if (!name || !title || !company) {
            alert('Please fill out all required fields: Name, Title, and Company.');
            return;
        }

        const id = 'u' + (graph.users.size + 1) + '-' + Math.floor(Math.random() * 1000);
        const skills = skillsString ? skillsString.split(',').map(s => s.trim()).filter(s => s.length > 0) : [];
        
        const success = graph.addUser(id, name, title, company, skills, color);
        
        if (success) {
            visualizer.syncWithGraph(graph);
            populateDropdowns();
            selectActiveUser(id); // auto focus newly created user
            updateStats();
            
            // Reset input values
            document.getElementById('newUserName').value = '';
            document.getElementById('newUserTitle').value = '';
            document.getElementById('newUserCompany').value = '';
            document.getElementById('newUserSkills').value = '';

            addUserModal.classList.remove('active');
            showConsoleInfo(`Successfully added node for ${name} to the social network.`);
        } else {
            alert('Failed to add user. Name might be duplicate.');
        }
    });

    // Add friendship connection
    document.getElementById('addEdgeBtn').addEventListener('click', () => {
        const u1 = edgeUser1.value;
        const u2 = edgeUser2.value;

        if (u1 === u2) {
            alert('Select two different users to establish a link.');
            return;
        }

        if (graph.areFriends(u1, u2)) {
            alert('These profiles are already connected.');
            return;
        }

        const success = graph.addEdge(u1, u2);
        if (success) {
            visualizer.syncWithGraph(graph);
            selectActiveUser(activeUserId);
            updateStats();
            showConsoleInfo(`Added friendship between ${graph.users.get(u1).name} and ${graph.users.get(u2).name}.`);
        }
    });

    // Remove connection
    document.getElementById('removeEdgeBtn').addEventListener('click', () => {
        const u1 = edgeUser1.value;
        const u2 = edgeUser2.value;

        if (u1 === u2) {
            alert('Select two different users.');
            return;
        }

        if (!graph.areFriends(u1, u2)) {
            alert('No direct friendship exists between these profiles.');
            return;
        }

        const success = graph.removeEdge(u1, u2);
        if (success) {
            visualizer.syncWithGraph(graph);
            selectActiveUser(activeUserId);
            updateStats();
            showConsoleInfo(`Severed the friendship between ${graph.users.get(u1).name} and ${graph.users.get(u2).name}.`);
        }
    });

    // Pathfinder BFS Shortest Path
    document.getElementById('runShortestPathBtn').addEventListener('click', () => {
        resetSimulationUI();
        const start = pathStart.value;
        const end = pathEnd.value;

        if (start === end) {
            showConsoleInfo(`Degrees of separation: 0. Nodes are the same.`);
            return;
        }

        const path = graph.findShortestPathBFS(start, end);
        clearLogs();
        
        if (path) {
            const names = path.map(id => graph.users.get(id).name);
            const degrees = path.length - 1;
            addLogEntry(`BFS Shortest Path search completed successfully!`, 'done');
            addLogEntry(`Connection: ${names.join(' ➔ ')}`, 'info');
            addLogEntry(`Degrees of separation: ${degrees} (${degrees === 1 ? '1st degree connection' : degrees === 2 ? '2nd degree connection' : degrees + 'rd degree connection'})`, 'info');

            // Draw glowing path edges in the visualizer
            const pathHighlights = { nodes: {}, edges: {} };
            path.forEach((id, idx) => {
                if (idx === 0) pathHighlights.nodes[id] = 'active';
                else if (idx === path.length - 1) pathHighlights.nodes[id] = 'destination';
                else pathHighlights.nodes[id] = 'path';

                if (idx > 0) {
                    const edgeKey = [path[idx-1], id].sort().join('-');
                    pathHighlights.edges[edgeKey] = 'path';
                }
            });
            visualizer.setHighlights(pathHighlights);
        } else {
            addLogEntry(`BFS Shortest Path completed.`, 'info');
            addLogEntry(`Result: These profiles are completely disconnected. No path exists in the network.`, 'error');
        }
    });

    // Pathfinder DFS All Paths
    document.getElementById('runDFSPathsBtn').addEventListener('click', () => {
        resetSimulationUI();
        const start = pathStart.value;
        const end = pathEnd.value;

        if (start === end) {
            showConsoleInfo(`Source and Target are identical.`);
            return;
        }

        // Just execute it instantly and show all paths
        const trace = graph.generateDFSTrace(start, end, 4);
        const finalFrame = trace[trace.length - 1];
        
        clearLogs();
        addLogEntry(`DFS Connection Pathfinder run finished.`, 'done');
        
        if (finalFrame.allPaths && finalFrame.allPaths.length > 0) {
            addLogEntry(`Found ${finalFrame.allPaths.length} unique connection path(s) within max depth 4:`, 'info');
            
            const pathEdgesHighlight = {};
            const pathNodesHighlight = {};

            finalFrame.allPaths.forEach((path, pathIdx) => {
                const names = path.map(id => graph.users.get(id).name);
                addLogEntry(`Path #${pathIdx + 1}: ${names.join(' ➔ ')}`, 'info');
                
                // Overlay multiple paths visually
                path.forEach((id, idx) => {
                    pathNodesHighlight[id] = 'path';
                    if (idx > 0) {
                        const edgeKey = [path[idx-1], id].sort().join('-');
                        pathEdgesHighlight[edgeKey] = 'path';
                    }
                });
            });

            pathNodesHighlight[start] = 'active';
            pathNodesHighlight[end] = 'destination';

            visualizer.setHighlights({ nodes: pathNodesHighlight, edges: pathEdgesHighlight });
        } else {
            addLogEntry(`Result: No paths found within depth limit of 4.`, 'error');
        }
    });

    // Modal Events
    openAddUserModalBtn.addEventListener('click', () => {
        addUserModal.classList.add('active');
    });

    const closeModal = () => addUserModal.classList.remove('active');
    closeAddUserModalBtn.addEventListener('click', closeModal);
    cancelAddUserBtn.addEventListener('click', closeModal);

    // active dropdown selector change
    activeUserSelect.addEventListener('change', () => {
        selectActiveUser(activeUserSelect.value);
        resetSimulationUI();
    });

    // Bind algorithm change to target selectors
    algorithmSelect.addEventListener('change', () => {
        const type = algorithmSelect.value;
        resetSimulationUI();
        
        // If DFS simulation, prompt target user
        if (type === 'dfs-path') {
            // Find a target that is different from focus
            const target = Array.from(graph.users.keys()).find(id => id !== activeUserId) || 'u10';
            dfsTargetId = target;
            addLogEntry(`DFS Simulation selected. Target node set to ${graph.users.get(dfsTargetId).name}. Click play to trace.`, 'info');
        }
    });

    // Reset Network Button
    document.getElementById('resetNetworkBtn').addEventListener('click', () => {
        if (confirm('Are you sure you want to rebuild the default social network? All customized nodes will be deleted.')) {
            graph.adjList.clear();
            graph.users.clear();
            seedGraph(graph);
            visualizer.syncWithGraph(graph);
            populateDropdowns();
            selectActiveUser('u1');
            resetSimulationUI();
            updateStats();
            showConsoleInfo(`Reinitialized database to default LinkedIn-mock social network.`);
        }
    });

    // Graph Visualizer Controls
    document.getElementById('recenterGraphBtn').addEventListener('click', () => {
        // Simple physics reset: pull nodes to center with random offsets to untangle
        const cx = visualizer.canvas.width / (2 * window.devicePixelRatio);
        const cy = visualizer.canvas.height / (2 * window.devicePixelRatio);
        visualizer.nodes.forEach(node => {
            node.x = cx + (Math.random() - 0.5) * 150;
            node.y = cy + (Math.random() - 0.5) * 150;
            node.vx = 0;
            node.vy = 0;
        });
        showConsoleInfo("Graph layout physics forces re-centered.");
    });

    document.getElementById('clearHighlightsBtn').addEventListener('click', () => {
        resetSimulationUI();
        showConsoleInfo("Visual state cleared.");
    });

    // Node click binding from Visualizer
    visualizer.onNodeClick = (clickedId) => {
        selectActiveUser(clickedId);
        // If simulation was running or details highlighted, reset
        if (simulationTrace.length > 0) {
            resetSimulationUI();
        }
        
        // If we are configuring paths, auto-fill inputs
        pathStart.value = clickedId;
        edgeUser1.value = clickedId;
    };

    // 11. Initial Startup Load
    populateDropdowns();
    selectActiveUser('u1');
    updateStats();
});

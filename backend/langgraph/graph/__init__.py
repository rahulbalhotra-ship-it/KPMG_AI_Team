# Local micro-implementation of Langgraph Graph interface for offline usage

END = "__end__"

class StateGraph:
    def __init__(self, state_schema):
        self.state_schema = state_schema
        self.nodes = {}
        self.edges = []
        self.entry_point = None
        self.conditional_entry_point = None
        self.conditional_edges = {}

    def add_node(self, name, func):
        self.nodes[name] = func
        return self

    def set_entry_point(self, name):
        self.entry_point = name
        return self

    def set_conditional_entry_point(self, route_func, path_map=None):
        self.conditional_entry_point = (route_func, path_map)
        return self

    def add_edge(self, start, end):
        self.edges.append((start, end))
        return self

    def add_conditional_edges(self, source, route_func, path_map=None):
        self.conditional_edges[source] = (route_func, path_map)
        return self

    def compile(self):
        return CompiledGraph(self)

class CompiledGraph:
    def __init__(self, graph):
        self.graph = graph

    def invoke(self, initial_state):
        current_state = initial_state.copy()
        
        # Resolve entry point (conditional or static)
        if self.graph.conditional_entry_point:
            route_func, path_map = self.graph.conditional_entry_point
            route_val = route_func(current_state)
            if path_map and route_val in path_map:
                current_node = path_map[route_val]
            else:
                current_node = route_val
        else:
            current_node = self.graph.entry_point
        
        # Simple loop to execute state graph transitions sequentially
        while current_node and current_node != END:
            node_func = self.graph.nodes.get(current_node)
            if not node_func:
                break
                
            # Run node function
            update = node_func(current_state)
            if update:
                # Merge updates into current state
                current_state.update(update)
            
            # Resolve next node transition
            next_node = None
            
            # 1. Try conditional edges first
            if current_node in self.graph.conditional_edges:
                route_func, path_map = self.graph.conditional_edges[current_node]
                route_val = route_func(current_state)
                if path_map and route_val in path_map:
                    next_node = path_map[route_val]
                else:
                    next_node = route_val
            
            # 2. Fall back to static edges
            if not next_node:
                for start, end in self.graph.edges:
                    if start == current_node:
                        next_node = end
                        break
            
            current_node = next_node
            
        return current_state

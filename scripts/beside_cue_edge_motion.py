"""Keep a cropped source edge outside the room until the actor clears it."""


def edge_offsets(contacts, rest_x, exiting=False, transition_frames=24, margin=4):
    """Return one registration x per frame, preserving the authored rest pose.

    `contacts` describes actual silhouette contact with the source's left edge,
    not elapsed time. Entrance releases AFTER its last contact; exit finishes
    moving the source boundary offscreen BEFORE its first contact. Smoothstep
    joins the held offsets without a velocity jump. No runtime work is needed.
    """
    if transition_frames < 1:
        raise ValueError("transition_frames must be positive")
    touched = [i for i, contact in enumerate(contacts) if contact]
    if not touched or rest_x <= -margin:
        return [rest_x] * len(contacts)
    edge_x = -margin
    if exiting:
        end = touched[0]
        start = max(0, end - transition_frames)
    else:
        start = touched[-1]
        end = min(len(contacts) - 1, start + transition_frames)

    result = []
    for frame in range(len(contacts)):
        progress = min(1, max(0, (frame - start) / max(1, end - start)))
        eased = progress * progress * (3 - 2 * progress)
        amount = 1 - eased if exiting else eased
        result.append(round(edge_x + (rest_x - edge_x) * amount))
    # A degenerate clip must still obey the edge invariant.
    for frame in touched:
        result[frame] = edge_x
    return result
